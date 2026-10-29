-- Call capture from the agent's Android phone: the phone app reports each call
-- (number, direction, time, length) to /api/calls with the agent's personal
-- phone key. A call with a client's number goes on that client's timeline as a
-- call, once; calls with other numbers are not stored. Only the key's SHA-256
-- hash is kept, and the agent can switch a key off at any time.

create table public.phone_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  label text not null default 'Telefon' check (char_length(label) between 1 and 100),
  token_hash text not null unique check (char_length(token_hash) = 64),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index phone_keys_user_idx on public.phone_keys (organization_id, user_id);

create trigger set_updated_at before update on public.phone_keys
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.phone_keys
  for each row execute function private.prevent_org_change();

alter table public.phone_keys enable row level security;
revoke all on public.phone_keys from anon, authenticated;
grant select, insert, update (revoked_at) on public.phone_keys to authenticated;

create policy "users read own keys" on public.phone_keys for select to authenticated
  using (user_id = (select auth.uid()));
create policy "members create own keys" on public.phone_keys for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "users revoke own keys" on public.phone_keys for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Which calls are already on a timeline, so a report sent twice counts once.
create table public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null,
  interaction_id uuid,
  direction text not null check (direction in ('incoming', 'outgoing', 'missed')),
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  unique (user_id, client_id, started_at),
  foreign key (client_id, organization_id) references public.clients (id, organization_id) on delete cascade
);
create index phone_calls_client_idx on public.phone_calls (client_id, organization_id);

alter table public.phone_calls enable row level security;
revoke all on public.phone_calls from anon, authenticated;
grant select on public.phone_calls to authenticated;
create policy "members read" on public.phone_calls for select to authenticated
  using (private.is_org_member(organization_id));

-- The phone app's way in. p_number is E.164 ("+36301234567"); clients match
-- on the last 9 digits of their phone number. Returns 'logged', 'duplicate',
-- 'invalid', 'unknown_number', or null for an unknown or switched-off key.
create function public.record_phone_call(
  p_token_hash text,
  p_number text,
  p_direction text,
  p_started_at timestamptz,
  p_duration_seconds integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  k public.phone_keys;
  digits text := right(regexp_replace(coalesce(p_number, ''), '\D', '', 'g'), 9);
  c record;
  call_id uuid;
  interaction uuid;
  minutes text;
begin
  select * into k from public.phone_keys where token_hash = p_token_hash and revoked_at is null;
  if not found then
    return null;
  end if;
  -- A key of someone who has left the workspace does nothing.
  if not exists (select 1 from public.organization_members m where m.organization_id = k.organization_id and m.user_id = k.user_id) then
    return null;
  end if;
  update public.phone_keys set last_used_at = now() where id = k.id;
  if p_direction not in ('incoming', 'outgoing', 'missed') or p_started_at is null
     or p_started_at > now() + interval '1 hour' or p_started_at < now() - interval '30 days'
     or p_duration_seconds is null or p_duration_seconds not between 0 and 86400
     or char_length(digits) < 8 then
    return 'invalid';
  end if;

  -- The most recently contacted active client with this number.
  select cl.id, cl.full_name into c
  from public.clients cl
  where cl.organization_id = k.organization_id
    and cl.archived_at is null
    and cl.phone is not null
    and right(regexp_replace(cl.phone, '\D', '', 'g'), 9) = digits
  order by cl.last_contacted_at desc nulls last, cl.created_at desc
  limit 1;
  if not found then
    return 'unknown_number';
  end if;

  insert into public.phone_calls (organization_id, user_id, client_id, direction, started_at, duration_seconds)
  values (k.organization_id, k.user_id, c.id, p_direction, p_started_at, p_duration_seconds)
  on conflict (user_id, client_id, started_at) do nothing
  returning id into call_id;
  if call_id is null then
    return 'duplicate';
  end if;

  minutes := case when p_duration_seconds < 60 then p_duration_seconds || ' mp' else round(p_duration_seconds / 60.0) || ' perc' end;
  insert into public.interactions (organization_id, client_id, property_id, created_by, interaction_type, occurred_at, summary, outcome, source)
  values (
    k.organization_id, c.id, null, k.user_id, 'call', p_started_at,
    case p_direction
      when 'incoming' then 'Bejövő hívás (' || minutes || ')'
      when 'outgoing' then 'Kimenő hívás (' || minutes || ')'
      else 'Nem fogadott hívás'
    end,
    case when p_direction = 'missed' then 'Nem fogadott' end,
    'manual'
  )
  returning id into interaction;
  update public.phone_calls set interaction_id = interaction where id = call_id;
  if p_direction <> 'missed' then
    update public.clients set last_contacted_at = greatest(coalesce(last_contacted_at, p_started_at), p_started_at)
      where id = c.id and organization_id = k.organization_id;
  end if;
  return 'logged';
end;
$$;
revoke all on function public.record_phone_call(text, text, text, timestamptz, integer) from public;
grant execute on function public.record_phone_call(text, text, text, timestamptz, integer) to anon, authenticated;
