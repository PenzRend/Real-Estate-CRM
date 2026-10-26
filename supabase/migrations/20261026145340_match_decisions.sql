-- What the agent decided about a suggested client ↔ property match.
-- Matches themselves are computed on demand from current data (rule-based,
-- with reasons); only the decision is stored, so a dismissed or actioned
-- pair is not suggested again.

create table public.property_client_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  client_id uuid not null,
  status text not null check (status in ('dismissed', 'task_created')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, client_id),
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade,
  foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete cascade
);
create index property_client_matches_client_idx on public.property_client_matches (client_id, organization_id);
create index property_client_matches_org_idx on public.property_client_matches (organization_id);

create trigger set_updated_at before update on public.property_client_matches
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.property_client_matches
  for each row execute function private.prevent_org_change();

revoke all on public.property_client_matches from anon, authenticated;
grant select, insert, update, delete on public.property_client_matches to authenticated;

alter table public.property_client_matches enable row level security;

create policy "members read" on public.property_client_matches for select to authenticated
  using (private.is_org_member(organization_id));
create policy "members insert" on public.property_client_matches for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members update" on public.property_client_matches for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
-- Any member may undo a decision (it is not business data).
create policy "members delete" on public.property_client_matches for delete to authenticated
  using (private.is_org_member(organization_id));
