-- Shareable listing pages for clients: a private link per listing. Visitors
-- see only what the page shows (no internal notes, no owner, the address only
-- if the agent allows it), through one function, and the listing's photos
-- while the link is active. Agents can revoke a link at any time.

create table public.property_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Random, unguessable, made by the app (base64url).
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  show_address boolean not null default false,
  contact_name text check (char_length(contact_name) <= 200),
  contact_phone text check (char_length(contact_phone) <= 50),
  contact_email text check (char_length(contact_email) <= 320),
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade
);
-- One active link per listing.
create unique index property_shares_one_active on public.property_shares (property_id) where revoked_at is null;
create index property_shares_org_idx on public.property_shares (organization_id);
create index property_shares_property_idx on public.property_shares (property_id, organization_id);

create trigger set_updated_at before update on public.property_shares
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.property_shares
  for each row execute function private.prevent_org_change();

revoke all on public.property_shares from anon, authenticated;
grant select, insert, update on public.property_shares to authenticated;
alter table public.property_shares enable row level security;

create policy "members read" on public.property_shares for select to authenticated
  using (private.is_org_member(organization_id));
create policy "members insert" on public.property_shares for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members update" on public.property_shares for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- The public page's only way in: the listing behind an active link, limited to
-- what the page shows, and a view counted. Null for unknown or revoked links
-- and archived listings.
create function public.shared_listing(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.property_shares;
  p public.properties;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{20,64}$' then
    return null;
  end if;
  select * into s from public.property_shares where token = p_token and revoked_at is null;
  if not found then
    return null;
  end if;
  select * into p from public.properties
    where id = s.property_id and organization_id = s.organization_id and archived_at is null;
  if not found then
    return null;
  end if;
  update public.property_shares set view_count = view_count + 1, last_viewed_at = now() where id = s.id;
  return jsonb_build_object(
    'title', p.title,
    'property_type', p.property_type,
    'listing_type', p.listing_type,
    'status', p.status,
    'city', p.city,
    'district', p.district,
    'address', case when s.show_address then p.address end,
    'postal_code', case when s.show_address then p.postal_code end,
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
    'features', p.features,
    'description', p.description,
    'agency', (select o.name from public.organizations o where o.id = p.organization_id),
    'contact', jsonb_build_object('name', s.contact_name, 'phone', s.contact_phone, 'email', s.contact_email),
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', m.id, 'kind', m.kind, 'path', m.storage_path, 'thumb', m.thumb_path, 'width', m.width, 'height', m.height, 'duration', m.duration_seconds, 'cover', m.is_cover)
        order by m.is_cover desc, m.position, m.created_at)
      from public.property_media m
      where m.property_id = p.id and m.organization_id = p.organization_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.shared_listing(text) from public;
grant execute on function public.shared_listing(text) to anon, authenticated;

-- For the storage policy below: is this file part of a listing with an active
-- link? Answers yes/no for one path only.
create function public.shared_media_visible(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.property_shares s
    join public.properties p on p.id = s.property_id and p.organization_id = s.organization_id
    where s.revoked_at is null
      and p.archived_at is null
      and s.organization_id::text = split_part(path, '/', 1)
      and s.property_id::text = split_part(path, '/', 2)
  );
$$;
revoke all on function public.shared_media_visible(text) from public;
grant execute on function public.shared_media_visible(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $p$create policy "property media: shared listings" on storage.objects for select to anon
      using (bucket_id = 'property-media' and public.shared_media_visible(name))$p$;
  end if;
end;
$$;
