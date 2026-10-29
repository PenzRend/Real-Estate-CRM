-- Weekly seller report: an email to the listing's owner about the week
-- (viewings and what buyers said, offers, interest). Per listing the agent
-- switches the Monday-morning sending on; every report is kept.

alter table public.properties
  add column seller_report_weekly boolean not null default false;

create table public.seller_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  client_id uuid,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  period_start date not null,
  period_end date not null,
  subject text not null check (char_length(subject) <= 300),
  body text not null check (char_length(body) <= 20000),
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  sent_at timestamptz,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete cascade,
  foreign key (client_id, organization_id) references public.clients (id, organization_id) on delete set null (client_id)
);
create index seller_reports_property_idx on public.seller_reports (property_id, organization_id, created_at desc);

create trigger set_updated_at before update on public.seller_reports for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.seller_reports for each row execute function private.prevent_org_change();
revoke all on public.seller_reports from anon, authenticated;
grant select, insert, update, delete on public.seller_reports to authenticated;
alter table public.seller_reports enable row level security;
create policy "members read" on public.seller_reports for select to authenticated using (private.is_org_member(organization_id));
create policy "members insert" on public.seller_reports for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members update" on public.seller_reports for update to authenticated
  using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id));
create policy "members delete" on public.seller_reports for delete to authenticated using (private.is_org_member(organization_id));
