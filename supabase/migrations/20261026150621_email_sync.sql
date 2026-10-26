-- Connected mailboxes and the emails imported from them.
-- Only relevant emails are stored (from/to clients, portal inquiries, likely
-- property inquiries). A mailbox and its emails are private to the user who
-- connected it; an email becomes visible to the workspace only when the agent
-- turns it into an interaction. OAuth tokens are encrypted by the app server
-- before they are stored.

create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  provider text not null check (provider in ('gmail')),
  email_address text not null check (char_length(email_address) <= 320),
  refresh_token_enc text not null,
  access_token_enc text,
  access_token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_error text check (char_length(last_error) <= 500),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, email_address),
  unique (id, organization_id)
);
create index mailboxes_org_idx on public.mailboxes (organization_id);

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  mailbox_id uuid not null,
  provider_message_id text not null,
  thread_id text,
  direction text not null check (direction in ('incoming', 'outgoing')),
  from_email text,
  from_name text,
  to_emails text[] not null default '{}',
  subject text check (char_length(subject) <= 1000),
  snippet text check (char_length(snippet) <= 1000),
  body_text text check (char_length(body_text) <= 20000),
  received_at timestamptz not null,
  portal text,
  client_id uuid,
  status text not null default 'new' check (status in ('new', 'processed', 'ignored')),
  interaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mailbox_id, provider_message_id),
  foreign key (mailbox_id, organization_id)
    references public.mailboxes (id, organization_id) on delete cascade,
  foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete set null (client_id),
  foreign key (interaction_id, organization_id)
    references public.interactions (id, organization_id) on delete set null (interaction_id)
);
create index emails_user_status_idx on public.emails (user_id, status, received_at desc);
create index emails_client_idx on public.emails (client_id, organization_id);
create index emails_mailbox_idx on public.emails (mailbox_id, organization_id);
create index emails_interaction_idx on public.emails (interaction_id, organization_id);

do $$
declare
  t text;
begin
  foreach t in array array['mailboxes', 'emails'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
    execute format(
      'create trigger prevent_org_change before update on public.%I
         for each row execute function private.prevent_org_change()', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    -- Owner only: the user who connected the mailbox, inside a workspace they belong to.
    execute format(
      'create policy "owner read" on public.%I for select to authenticated
         using (user_id = (select auth.uid()) and private.is_org_member(organization_id))', t);
    execute format(
      'create policy "owner insert" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()) and private.is_org_member(organization_id))', t);
    execute format(
      'create policy "owner update" on public.%I for update to authenticated
         using (user_id = (select auth.uid()) and private.is_org_member(organization_id))
         with check (user_id = (select auth.uid()) and private.is_org_member(organization_id))', t);
    execute format(
      'create policy "owner delete" on public.%I for delete to authenticated
         using (user_id = (select auth.uid()) and private.is_org_member(organization_id))', t);
  end loop;
end;
$$;
