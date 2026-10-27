-- Viewings: a client sees a listing at a set time. Booked by the agent (often
-- from a client's email), optionally put in the agent's Google Calendar, and
-- closed with the client's feedback, which goes on the client's timeline.

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  property_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  starts_at timestamptz not null,
  duration_minutes integer not null default 45 check (duration_minutes between 10 and 480),
  location text check (char_length(location) <= 500),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'no_show', 'cancelled')),
  -- The email the viewing was booked from (private to its owner; kept only as a reference).
  source_email_id uuid references public.emails (id) on delete set null,
  -- The Google Calendar event, in the calendar of the user who added it.
  calendar_user_id uuid references public.profiles (id) on delete set null,
  calendar_event_id text check (char_length(calendar_event_id) <= 1024),
  calendar_link text check (char_length(calendar_link) <= 2000),
  -- Feedback after the viewing.
  interest text check (interest in ('high', 'medium', 'low', 'none')),
  feedback text check (char_length(feedback) <= 5000),
  feedback_at timestamptz,
  interaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('completed', 'no_show')) = (feedback_at is not null)),
  foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete cascade,
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade,
  foreign key (interaction_id, organization_id)
    references public.interactions (id, organization_id) on delete set null (interaction_id)
);
create index viewings_org_starts_idx on public.viewings (organization_id, starts_at) where status = 'scheduled';
create index viewings_client_idx on public.viewings (client_id, starts_at desc);
create index viewings_property_idx on public.viewings (property_id, starts_at desc);
create index viewings_source_email_idx on public.viewings (source_email_id);

create trigger set_updated_at before update on public.viewings
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.viewings
  for each row execute function private.prevent_org_change();

revoke all on public.viewings from anon, authenticated;
grant select, insert, update on public.viewings to authenticated;
alter table public.viewings enable row level security;

create policy "members read" on public.viewings for select to authenticated
  using (private.is_org_member(organization_id));
create policy "members insert" on public.viewings for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members update" on public.viewings for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- Google Calendar is a separate permission, like sending.
alter table public.mailboxes
  add column can_calendar boolean not null default false;

-- What the AI read from an email about a viewing request (times as local
-- Budapest wall-clock strings, e.g. "2026-11-03T17:00").
alter table public.emails
  add column ai_viewing jsonb check (ai_viewing is null or jsonb_typeof(ai_viewing) = 'object');
