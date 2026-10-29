-- Portal export: one private XML link per workspace that lists the listings
-- the agents marked "Portálokra" (active, not archived), for real estate
-- portals to import. Portals fetch it without cookies, so the link's secret
-- token is the permission; only its SHA-256 hash is stored, and a new link
-- replaces the old one. The street address is never in the feed (city,
-- district and postal code are); owners and internal notes never are.

alter table public.properties add column portal_export boolean not null default false;
create index properties_portal_export_idx on public.properties (organization_id) where portal_export and archived_at is null;

create table public.listing_feeds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  token_hash text not null unique check (char_length(token_hash) = 64),
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.listing_feeds
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.listing_feeds
  for each row execute function private.prevent_org_change();

alter table public.listing_feeds enable row level security;
revoke all on public.listing_feeds from anon, authenticated;
grant select, insert, update (token_hash) on public.listing_feeds to authenticated;

create policy "members read" on public.listing_feeds for select to authenticated
  using (private.is_org_member(organization_id));
create policy "managers create" on public.listing_feeds for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy "managers renew" on public.listing_feeds for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));

-- The feed's listings, limited to what portals show. Null for an unknown link.
create function public.listing_feed(p_token_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  f public.listing_feeds;
begin
  select * into f from public.listing_feeds where token_hash = p_token_hash;
  if not found then
    return null;
  end if;
  update public.listing_feeds set last_fetched_at = now() where id = f.id;
  return jsonb_build_object(
    'agency', (select o.name from public.organizations o where o.id = f.organization_id),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'reference', p.reference_number,
        'title', p.title,
        'property_type', p.property_type,
        'listing_type', p.listing_type,
        'status', p.status,
        'country', p.country,
        'city', p.city,
        'district', p.district,
        'postal_code', p.postal_code,
        'price', p.price,
        'currency', p.currency,
        'area_sqm', p.area_sqm,
        'room_count', p.room_count,
        'bedroom_count', p.bedroom_count,
        'bathroom_count', p.bathroom_count,
        'floor', p.floor,
        'building_type', p.building_type,
        'condition', p.condition,
        'energy_rating', p.energy_rating,
        'has_balcony', p.has_balcony,
        'has_garden', p.has_garden,
        'has_parking', p.has_parking,
        'description', p.description,
        'updated_at', p.updated_at,
        'agent', (select jsonb_build_object('name', pr.full_name, 'email', pr.email)
                  from public.profiles pr
                  join public.organization_members m on m.user_id = pr.id and m.organization_id = p.organization_id
                  where pr.id = coalesce(p.assigned_to, p.created_by)),
        'photos', coalesce((
          select jsonb_agg(m.id order by m.is_cover desc, m.position, m.created_at)
          from public.property_media m
          where m.property_id = p.id and m.organization_id = p.organization_id and m.kind = 'photo'
        ), '[]'::jsonb)
      ) order by p.updated_at desc)
      from public.properties p
      where p.organization_id = f.organization_id
        and p.portal_export
        and p.archived_at is null
        and p.status in ('active', 'reserved', 'under_negotiation')
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.listing_feed(text) from public;
grant execute on function public.listing_feed(text) to anon, authenticated;

-- One photo of a listing in the feed: its storage path, or null.
create function public.listing_feed_photo(p_token_hash text, p_media_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.storage_path
  from public.listing_feeds f
  join public.properties p on p.organization_id = f.organization_id and p.portal_export and p.archived_at is null
  join public.property_media m on m.property_id = p.id and m.organization_id = p.organization_id and m.kind = 'photo'
  where f.token_hash = p_token_hash and m.id = p_media_id;
$$;
revoke all on function public.listing_feed_photo(text, uuid) from public;
grant execute on function public.listing_feed_photo(text, uuid) to anon, authenticated;

-- For the storage policy below: is this file a photo of a listing in its
-- workspace's portal feed? Answers yes/no for one path only.
create function public.feed_media_visible(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.listing_feeds f
    join public.properties p on p.organization_id = f.organization_id and p.portal_export and p.archived_at is null
    where f.organization_id::text = split_part(path, '/', 1)
      and p.id::text = split_part(path, '/', 2)
  );
$$;
revoke all on function public.feed_media_visible(text) from public;
grant execute on function public.feed_media_visible(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $p$create policy "property media: portal feed" on storage.objects for select to anon
      using (bucket_id = 'property-media' and public.feed_media_visible(name))$p$;
  end if;
end;
$$;
