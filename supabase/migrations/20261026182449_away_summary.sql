-- "While you were away": AI reply drafts on imported emails, and each user's
-- last dashboard visit. Both stay private to the user, like their emails.

alter table public.emails
  -- Portals send inquiries from a no-reply address with the inquirer in Reply-To.
  add column reply_to_email text check (char_length(reply_to_email) <= 320),
  add column ai_summary text check (char_length(ai_summary) <= 500),
  add column ai_next_step text check (char_length(ai_next_step) <= 300),
  add column draft_to text check (char_length(draft_to) <= 320),
  add column draft_subject text check (char_length(draft_subject) <= 300),
  add column draft_body text check (char_length(draft_body) <= 5000),
  add column drafted_at timestamptz;

create table public.user_visits (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  -- Start of the "away" window: the visit before the current session.
  previous_seen_at timestamptz,
  primary key (user_id, organization_id)
);
create index user_visits_org_idx on public.user_visits (organization_id);

revoke all on public.user_visits from anon, authenticated;
grant select, insert, update on public.user_visits to authenticated;
alter table public.user_visits enable row level security;

create policy "owner read" on public.user_visits for select to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "owner insert" on public.user_visits for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "owner update" on public.user_visits for update to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id))
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
