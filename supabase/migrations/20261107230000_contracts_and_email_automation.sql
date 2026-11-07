-- Contracts drafted by Flavio, and emails that go out by themselves.
--
-- contract_drafts: an agency agreement, viewing declaration, reservation
-- agreement, sale contract draft, lease or handover record, made from a
-- deal, client or listing (by hand, or by itself on an event) for the agent
-- to review, complete and approve. The text keeps its {fields}; the values
-- the agent adds (parcel number, meter readings…) and anything personal are
-- stored encrypted by the server (extra_enc). Approving writes the Word file
-- into Dokumentumok (document_id).
--
-- email_templates + email_outbox: the office's email rules ("welcome a new
-- client", "thank them after a viewing"…). An event puts a message in the
-- outbox, rendered for that client; it is sent from the agent's own mailbox
-- after a delay – by itself (mode auto) or once the agent approves it.

create table public.contract_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null check (kind in ('megbizasi', 'megtekintesi', 'foglalasi', 'adasveteli', 'berleti', 'atadas')),
  title text not null check (char_length(title) between 1 and 300),
  deal_id uuid references public.deals (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  origin text not null default 'manual' check (origin in ('manual', 'auto')),
  body text not null default '' check (char_length(body) <= 200000),
  extra_enc text check (char_length(extra_enc) <= 80000),
  document_id uuid references public.office_documents (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deal_id is not null or client_id is not null or property_id is not null)
);
create index contract_drafts_org_idx on public.contract_drafts (organization_id, status, created_at desc);
create index contract_drafts_records_idx on public.contract_drafts (organization_id, deal_id, client_id, property_id);

create trigger set_updated_at before update on public.contract_drafts for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.contract_drafts for each row execute function private.prevent_org_change();
alter table public.contract_drafts enable row level security;
revoke all on public.contract_drafts from anon, authenticated;
grant select, insert, delete on public.contract_drafts to authenticated;
grant update (title, status, body, extra_enc, document_id, approved_by, approved_at) on public.contract_drafts to authenticated;
create policy "members read" on public.contract_drafts for select to authenticated using (private.is_org_member(organization_id));
create policy "members create" on public.contract_drafts for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members edit" on public.contract_drafts for update to authenticated
  using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id));
create policy "members remove" on public.contract_drafts for delete to authenticated using (private.is_org_member(organization_id));

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  subject text not null default '' check (char_length(subject) <= 300),
  body text not null default '' check (char_length(body) <= 20000),
  trigger text not null default 'manual'
    check (trigger in ('manual', 'client_created', 'viewing_booked', 'viewing_completed', 'deal_created', 'deal_won', 'no_contact')),
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 43200),
  no_contact_days integer check (no_contact_days between 1 and 365),
  mode text not null default 'approve' check (mode in ('auto', 'approve')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_templates_org_idx on public.email_templates (organization_id, trigger) where active;

create trigger set_updated_at before update on public.email_templates for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.email_templates for each row execute function private.prevent_org_change();
alter table public.email_templates enable row level security;
revoke all on public.email_templates from anon, authenticated;
grant select, insert, delete on public.email_templates to authenticated;
grant update (name, subject, body, trigger, delay_minutes, no_contact_days, mode, active) on public.email_templates to authenticated;
create policy "members read" on public.email_templates for select to authenticated using (private.is_org_member(organization_id));
create policy "members create" on public.email_templates for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "creator or manager edits" on public.email_templates for update to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.is_org_member(organization_id));
create policy "creator or manager removes" on public.email_templates for delete to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']));

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid references public.email_templates (id) on delete set null,
  -- The agent whose mailbox sends it.
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  -- One message per template and event (e.g. "viewing:<id>"), however often the event is seen.
  event_key text not null check (char_length(event_key) <= 200),
  to_email text not null check (char_length(to_email) <= 320),
  subject text not null check (char_length(subject) <= 300),
  body text not null check (char_length(body) <= 20000),
  status text not null default 'awaiting_approval' check (status in ('awaiting_approval', 'queued', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index email_outbox_event_key on public.email_outbox (template_id, event_key) where template_id is not null;
create index email_outbox_due_idx on public.email_outbox (status, scheduled_at) where status = 'queued';
create index email_outbox_org_idx on public.email_outbox (organization_id, created_at desc);

create trigger set_updated_at before update on public.email_outbox for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.email_outbox for each row execute function private.prevent_org_change();
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select, insert on public.email_outbox to authenticated;
grant update (subject, body, status, scheduled_at, sent_at, error) on public.email_outbox to authenticated;
create policy "members read" on public.email_outbox for select to authenticated using (private.is_org_member(organization_id));
create policy "members queue" on public.email_outbox for insert to authenticated with check (private.is_org_member(organization_id));
create policy "members approve or cancel" on public.email_outbox for update to authenticated
  using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id));
