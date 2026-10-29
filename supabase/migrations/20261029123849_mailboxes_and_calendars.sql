-- Several mailboxes per agent, any IMAP/SMTP mailbox next to Gmail and Outlook
-- (business domains, iCloud, Yahoo…), and outside calendars shown in Flavio.

-- 1. IMAP mailboxes. The app password is stored encrypted in refresh_token_enc
--    (like an OAuth refresh token); the server addresses go in server_settings.
alter table public.mailboxes drop constraint mailboxes_provider_check;
alter table public.mailboxes add constraint mailboxes_provider_check check (provider in ('gmail', 'outlook', 'imap'));
alter table public.mailboxes
  add column server_settings jsonb check (server_settings is null or jsonb_typeof(server_settings) = 'object');

-- 2. One mailbox per agent and workspace is the default sender (offers, new emails).
alter table public.mailboxes add column is_primary boolean not null default false;
create unique index mailboxes_one_primary on public.mailboxes (user_id, organization_id) where is_primary;
update public.mailboxes m set is_primary = true
where m.id = (
  select n.id from public.mailboxes n
  where n.user_id = m.user_id and n.organization_id = m.organization_id
  order by n.created_at desc limit 1
);

-- 3. Which mailbox's calendar holds a viewing's event, so moving or cancelling
--    it goes to the same calendar when the agent has several.
alter table public.viewings
  add column calendar_mailbox_id uuid,
  add foreign key (calendar_mailbox_id, organization_id)
    references public.mailboxes (id, organization_id) on delete set null (calendar_mailbox_id);
create index viewings_calendar_mailbox_idx on public.viewings (calendar_mailbox_id, organization_id) where calendar_mailbox_id is not null;

-- 4. Outside calendars (iCloud, Google, Outlook or any iCal link) shown in the
--    Flavio calendar. The link is secret (it grants read access to the
--    calendar), so the app stores it encrypted. Private to the agent.
create table public.calendar_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  url_enc text not null,
  color text not null default 'sky' check (color in ('sky', 'violet', 'amber', 'rose', 'emerald', 'slate')),
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index calendar_subscriptions_user_idx on public.calendar_subscriptions (user_id, organization_id);

create trigger set_updated_at before update on public.calendar_subscriptions
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.calendar_subscriptions
  for each row execute function private.prevent_org_change();
revoke all on public.calendar_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.calendar_subscriptions to authenticated;
alter table public.calendar_subscriptions enable row level security;
create policy "owner read" on public.calendar_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "owner insert" on public.calendar_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "owner update" on public.calendar_subscriptions for update to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id))
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "owner delete" on public.calendar_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
