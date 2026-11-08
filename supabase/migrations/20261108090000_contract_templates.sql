-- The office's own wording for each contract Flavio drafts.
--
-- contract_templates: one row per office and contract kind, replacing
-- Flavio's built-in text (lib/contracts/kinds.ts) when present. The text is
-- in the document creator's language ({fields}, # headings, **bold**). It is
-- written by hand or recreated by the AI from the office's own Word or PDF
-- contract (source_name). custom_fields labels the fields the office's text
-- adds ([{"key": "kozos_koltseg", "label": "Közös költség"}]). Members read
-- it; owners and admins change it. Removing the row restores Flavio's text.

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('megbizasi', 'megtekintesi', 'foglalasi', 'adasveteli', 'berleti', 'atadas')),
  body text not null check (char_length(body) between 1 and 200000),
  custom_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_fields) = 'array'),
  source_name text check (char_length(source_name) <= 300),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kind)
);

create trigger set_updated_at before update on public.contract_templates for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.contract_templates for each row execute function private.prevent_org_change();
alter table public.contract_templates enable row level security;
revoke all on public.contract_templates from anon, authenticated;
grant select, insert, delete on public.contract_templates to authenticated;
grant update (body, custom_fields, source_name, updated_by) on public.contract_templates to authenticated;
create policy "members read" on public.contract_templates for select to authenticated using (private.is_org_member(organization_id));
create policy "managers create" on public.contract_templates for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy "managers edit" on public.contract_templates for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy "managers remove" on public.contract_templates for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
