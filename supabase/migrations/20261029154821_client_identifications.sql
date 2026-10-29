-- Customer due diligence under the Hungarian AML act (Pmt.): who the client
-- is, checked against an ID document, whether they are a politically exposed
-- person, the beneficial owners of a company, the source of funds. The
-- personal data is encrypted by the app server (data_enc); only what lists and
-- warnings need is stored in the open. Kept for 8 years (Pmt.), so a client
-- with an identification is not erased before that.

create table public.client_identifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null check (kind in ('person', 'company')),
  data_enc text not null check (char_length(data_enc) <= 40000),
  pep boolean not null default false,
  risk text not null default 'normal' check (risk in ('low', 'normal', 'high')),
  document_expires_on date,
  verified_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id),
  foreign key (client_id, organization_id) references public.clients (id, organization_id) on delete cascade
);
create index client_identifications_org_idx on public.client_identifications (organization_id);

create trigger set_updated_at before update on public.client_identifications for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.client_identifications for each row execute function private.prevent_org_change();
revoke all on public.client_identifications from anon, authenticated;
grant select, insert, update on public.client_identifications to authenticated;
alter table public.client_identifications enable row level security;
create policy "members read" on public.client_identifications for select to authenticated using (private.is_org_member(organization_id));
create policy "members insert" on public.client_identifications for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members update" on public.client_identifications for update to authenticated
  using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id));
