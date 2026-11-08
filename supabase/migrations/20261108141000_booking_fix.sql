-- book_viewing_public: its variables renamed (v_…), so none shares a name
-- with a column of clients or viewings (Postgres refused "email" as ambiguous).

create or replace function public.book_viewing_public(
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
  v_minute integer;
  v_digits text;
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_client uuid;
  v_viewing uuid;
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
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if char_length(v_digits) < 9 and v_email is null then
    return jsonb_build_object('ok', false, 'error', 'Adj meg telefonszámot vagy e-mail-címet, hogy az ingatlanos elérjen.');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'Az e-mail-cím nem tűnik helyesnek.');
  end if;
  if char_length(coalesce(p_phone, '')) > 50 or char_length(coalesce(v_email, '')) > 320 or char_length(coalesce(p_note, '')) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'Túl hosszú adat.');
  end if;

  -- The slot: on the grid of the agent's hours, Budapest time.
  local_ts := p_start at time zone 'Europe/Budapest';
  v_minute := extract(hour from local_ts)::integer * 60 + extract(minute from local_ts)::integer;
  if p_start < now() + make_interval(hours => l.notice_hours)
     or p_start > now() + make_interval(days => l.horizon_days)
     or not (extract(isodow from local_ts)::smallint = any (l.days))
     or v_minute < l.start_minute
     or v_minute + l.slot_minutes > l.end_minute
     or (v_minute - l.start_minute) % l.slot_minutes <> 0
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
  select c.id into v_client from public.clients c
   where c.organization_id = l.organization_id and c.archived_at is null
     and ((char_length(v_digits) >= 9 and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9))
       or (v_email is not null and lower(c.email) = v_email))
   order by c.updated_at desc
   limit 1;
  if v_client is null then
    insert into public.clients (organization_id, full_name, phone, email, client_type, status, lead_source, assigned_to, created_by)
    values (l.organization_id, trim(p_name), nullif(trim(coalesce(p_phone, '')), ''), v_email, 'buyer', 'new_lead', 'Online foglalás', l.user_id, l.user_id)
    returning id into v_client;
  end if;

  insert into public.viewings (organization_id, client_id, property_id, created_by, starts_at, duration_minutes, location, notes, booking_link_id)
  values (
    l.organization_id, v_client, prop.id, l.user_id, p_start, l.slot_minutes,
    nullif(concat_ws(', ', nullif(concat_ws(' ', prop.postal_code, prop.city), ''), prop.district, prop.address), ''),
    concat_ws(E'\n', 'Online foglalás', nullif(trim(coalesce(p_note, '')), '')),
    l.id
  )
  returning id into v_viewing;

  return jsonb_build_object('ok', true, 'viewing_id', v_viewing, 'agent_id', l.user_id, 'title', prop.title);
end;
$$;
