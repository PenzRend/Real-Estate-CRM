-- Calendar subscription: a private link (iPhone/Mac Calendar, Outlook, any
-- app that subscribes to an .ics URL) that lists the agent's viewings. Calendar
-- apps send no cookies, so the link's secret token is the permission; only its
-- SHA-256 hash is stored, and a new link replaces the old one.

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index calendar_feeds_user_idx on public.calendar_feeds (user_id);

create trigger set_updated_at before update on public.calendar_feeds
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.calendar_feeds
  for each row execute function private.prevent_org_change();

alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon, authenticated;
grant select, insert, update (token_hash) on public.calendar_feeds to authenticated;

create policy "users read own feed" on public.calendar_feeds
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members create own feed" on public.calendar_feeds
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "users renew own feed" on public.calendar_feeds
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The feed's viewings: those the agent booked or holds in their calendar,
-- from 60 days back. Nothing when the agent has left the workspace.
create function public.calendar_feed(p_token_hash text)
returns table (
  id uuid,
  starts_at timestamptz,
  duration_minutes integer,
  status text,
  location text,
  notes text,
  client_name text,
  client_phone text,
  property_title text,
  property_address text,
  updated_at timestamptz,
  workspace_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.starts_at,
    v.duration_minutes,
    v.status,
    v.location,
    v.notes,
    c.full_name,
    c.phone,
    p.title,
    concat_ws(', ', nullif(concat_ws(' ', p.postal_code, p.city), ''), p.district, p.address),
    v.updated_at,
    o.name
  from public.calendar_feeds f
  join public.organization_members m on m.organization_id = f.organization_id and m.user_id = f.user_id
  join public.organizations o on o.id = f.organization_id
  join public.viewings v on v.organization_id = f.organization_id
    and (v.created_by = f.user_id or v.calendar_user_id = f.user_id)
    and v.starts_at > now() - interval '60 days'
  join public.clients c on c.id = v.client_id
  join public.properties p on p.id = v.property_id
  where f.token_hash = p_token_hash
  order by v.starts_at
  limit 2000;
$$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
