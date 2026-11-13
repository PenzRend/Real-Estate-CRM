-- Jófogás reads the portal feed in its own XML format (/api/feed/<token>/jofogas.xml).
-- It needs the partner ID it assigns and a mobile number on every listing; the
-- workspace's managers set both next to the feed link. The feed function also
-- returns the listing extras (heating, lift, year built…) and these settings.

alter table public.listing_feeds
  add column jofogas_partner_id text check (jofogas_partner_id ~ '^[A-Za-z0-9_-]{1,50}$'),
  add column jofogas_phone text check (jofogas_phone ~ '^\+36[0-9]{9}$');

-- Same policy as the token ("managers renew"): only owners and admins update the row.
grant update (jofogas_partner_id, jofogas_phone) on public.listing_feeds to authenticated;

create or replace function public.listing_feed(p_token_hash text)
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
    'jofogas', jsonb_build_object(
      'partner_id', f.jofogas_partner_id,
      'phone', f.jofogas_phone,
      'email', (select pr.email from public.organization_members m join public.profiles pr on pr.id = m.user_id
                where m.organization_id = f.organization_id and m.role = 'owner' order by m.created_at limit 1)
    ),
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
        'features', p.features,
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
