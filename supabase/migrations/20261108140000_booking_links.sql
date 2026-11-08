-- Clients book viewings themselves: each agent can switch on a private
-- booking link (/b/<token>) with the days, hours, viewing length, notice and
-- how far ahead clients may book. The public page goes through two
-- functions only: one shows the agent's active listings and busy times
-- (nothing private), the other books a slot after checking it again. A
-- booking finds the client by phone or email, or adds them as a new lead,
-- and creates the viewing in the agent's name.

create table public.booking_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  -- Random, unguessable, made by the app (base64url).
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  active boolean not null default true,
  -- ISO weekdays: 1 = Monday … 7 = Sunday.
  days smallint[] not null default '{1,2,3,4,5}' check (days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(days) > 0),
  -- Minutes from midnight, Budapest time.
  start_minute integer not null default 540 check (start_minute between 0 and 1425),
  end_minute integer not null default 1080 check (end_minute between 15 and 1440),
  slot_minutes integer not null default 45 check (slot_minutes between 15 and 180),
  notice_hours integer not null default 12 check (notice_hours between 0 and 168),
  horizon_days integer not null default 14 check (horizon_days between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_minute > start_minute),
  unique (organization_id, user_id)
);

create trigger set_updated_at before update on public.booking_links for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.booking_links for each row execute function private.prevent_org_change();
alter table public.booking_links enable row level security;
revoke all on public.booking_links from anon, authenticated;
grant select, insert on public.booking_links to authenticated;
grant update (active, days, start_minute, end_minute, slot_minutes, notice_hours, horizon_days, token) on public.booking_links to authenticated;
create policy "own link" on public.booking_links for select to authenticated using (user_id = (select auth.uid()));
create policy "own link create" on public.booking_links for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "own link edit" on public.booking_links for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Which link a viewing was booked through (rate limit, and "Online foglalás" on the viewing).
alter table public.viewings add column booking_link_id uuid references public.booking_links (id) on delete set null;
create index viewings_booking_link_idx on public.viewings (booking_link_id, created_at) where booking_link_id is not null;

-- The public page: the agent's name and office, the link's settings, the
-- office's active listings (title, area, price only) and the agent's busy
-- times in the bookable window. Null for an unknown or switched-off link.
create function public.booking_page(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.booking_links;
begin
  select * into l from public.booking_links where token = p_token and active;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'agent', (select coalesce(nullif(p.full_name, ''), 'Az ingatlanos') from public.profiles p where p.id = l.user_id),
    'agency', (select o.name from public.organizations o where o.id = l.organization_id),
    'days', l.days,
    'start_minute', l.start_minute,
    'end_minute', l.end_minute,
    'slot_minutes', l.slot_minutes,
    'notice_hours', l.notice_hours,
    'horizon_days', l.horizon_days,
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'city', p.city, 'district', p.district, 'price', p.price, 'currency', p.currency, 'listing_type', p.listing_type) order by p.updated_at desc)
      from (
        select * from public.properties p
        where p.organization_id = l.organization_id and p.status = 'active' and p.archived_at is null
        order by p.updated_at desc
        limit 100
      ) p
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('start', v.starts_at, 'minutes', v.duration_minutes))
      from public.viewings v
      where v.organization_id = l.organization_id
        and coalesce(v.calendar_user_id, v.created_by) = l.user_id
        and v.status = 'scheduled'
        and v.starts_at between now() - interval '1 day' and now() + make_interval(days => l.horizon_days + 1)
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.booking_page(text) from public;
grant execute on function public.booking_page(text) to anon, authenticated;

-- Books one slot, checking everything again: the link, the listing, the day
-- and time, the notice, the window, the agent's other viewings, and at most
-- ten bookings an hour through one link.
create function public.book_viewing_public(
  p_token text,
  p_property uuid,
  p_start timestamptz,
  p_name text,
  p_phone text,
  p_email text,
  p_note text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.booking_links;
  prop public.properties;
  local_ts timestamp;
  minute integer;
  digits text;
  email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  client uuid;
  viewing uuid;
begin
  select * into l from public.booking_links where token = p_token and active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ez a foglalási link már nem él.');
  end if;
  select * into prop from public.properties
   where id = p_property and organization_id = l.organization_id and status = 'active' and archived_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ez az ingatlan már nem foglalható.');
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 200 then
    return jsonb_build_object('ok', false, 'error', 'Add meg a neved.');
  end if;
  digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if char_length(digits) < 9 and email is null then
    return jsonb_build_object('ok', false, 'error', 'Adj meg telefonszámot vagy e-mail-címet, hogy az ingatlanos elérjen.');
  end if;
  if email is not null and email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'Az e-mail-cím nem tűnik helyesnek.');
  end if;
  if char_length(coalesce(p_phone, '')) > 50 or char_length(coalesce(email, '')) > 320 or char_length(coalesce(p_note, '')) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'Túl hosszú adat.');
  end if;

  -- The slot: on the grid of the agent's hours, Budapest time.
  local_ts := p_start at time zone 'Europe/Budapest';
  minute := extract(hour from local_ts)::integer * 60 + extract(minute from local_ts)::integer;
  if p_start < now() + make_interval(hours => l.notice_hours)
     or p_start > now() + make_interval(days => l.horizon_days)
     or not (extract(isodow from local_ts)::smallint = any (l.days))
     or minute < l.start_minute
     or minute + l.slot_minutes > l.end_minute
     or (minute - l.start_minute) % l.slot_minutes <> 0
     or extract(second from local_ts) <> 0 then
    return jsonb_build_object('ok', false, 'error', 'Ez az időpont nem foglalható. Válassz egy másikat.');
  end if;
  if exists (
    select 1 from public.viewings v
     where v.organization_id = l.organization_id
       and coalesce(v.calendar_user_id, v.created_by) = l.user_id
       and v.status = 'scheduled'
       and v.starts_at < p_start + make_interval(mins => l.slot_minutes)
       and v.starts_at + make_interval(mins => v.duration_minutes) > p_start
  ) then
    return jsonb_build_object('ok', false, 'error', 'Ezt az időpontot közben lefoglalták. Válassz egy másikat.');
  end if;
  if (select count(*) from public.viewings v where v.booking_link_id = l.id and v.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'Most túl sok foglalás érkezett. Próbáld újra egy óra múlva, vagy hívd az ingatlanost.');
  end if;

  -- The client: by phone (last nine digits) or email, else a new lead.
  select c.id into client from public.clients c
   where c.organization_id = l.organization_id and c.archived_at is null
     and ((char_length(digits) >= 9 and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = right(digits, 9))
       or (email is not null and lower(c.email) = email))
   order by c.updated_at desc
   limit 1;
  if client is null then
    insert into public.clients (organization_id, full_name, phone, email, client_type, status, lead_source, assigned_to, created_by)
    values (l.organization_id, trim(p_name), nullif(trim(coalesce(p_phone, '')), ''), email, 'buyer', 'new_lead', 'Online foglalás', l.user_id, l.user_id)
    returning id into client;
  end if;

  insert into public.viewings (organization_id, client_id, property_id, created_by, starts_at, duration_minutes, location, notes, booking_link_id)
  values (
    l.organization_id, client, prop.id, l.user_id, p_start, l.slot_minutes,
    nullif(concat_ws(', ', nullif(concat_ws(' ', prop.postal_code, prop.city), ''), prop.district, prop.address), ''),
    concat_ws(E'\n', 'Online foglalás', nullif(trim(coalesce(p_note, '')), '')),
    l.id
  )
  returning id into viewing;

  return jsonb_build_object('ok', true, 'viewing_id', viewing, 'agent_id', l.user_id, 'title', prop.title);
end;
$$;
revoke all on function public.book_viewing_public(text, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.book_viewing_public(text, uuid, timestamptz, text, text, text, text) to anon, authenticated;
