-- Documents tied to records, and documents written from templates:
-- * office_document_links: a file in Dokumentumok belongs to clients,
--   listings or deals (set by hand, suggested by the AI on upload, or by the
--   template that wrote it). The record pages list their files.
-- * document_templates: the office's own templates, written in Flavio: text
--   with {fields} filled from the record and [[AI: …]] paragraphs the AI
--   writes. A template can run by itself when a client is added or a deal
--   starts; the result is saved as a Word file in the chosen folder, linked.

create table public.office_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.office_documents (id) on delete cascade,
  record_kind text not null check (record_kind in ('client', 'property', 'deal')),
  record_id uuid not null,
  source text not null default 'manual' check (source in ('manual', 'ai', 'template')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (document_id, record_kind, record_id)
);
create index office_document_links_record_idx on public.office_document_links (organization_id, record_kind, record_id);

alter table public.office_document_links enable row level security;
revoke all on public.office_document_links from anon, authenticated;
grant select, insert, delete on public.office_document_links to authenticated;
create policy "members read" on public.office_document_links for select to authenticated using (private.is_org_member(organization_id));
create policy "members link" on public.office_document_links for insert to authenticated
  with check (
    private.is_org_member(organization_id)
    and exists (select 1 from public.office_documents d where d.id = document_id and d.organization_id = office_document_links.organization_id)
  );
create policy "members unlink" on public.office_document_links for delete to authenticated using (private.is_org_member(organization_id));

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 100000),
  trigger text not null default 'manual' check (trigger in ('manual', 'client_created', 'deal_created')),
  folder_id uuid references public.office_document_folders (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index document_templates_org_idx on public.document_templates (organization_id, trigger) where active;

create trigger set_updated_at before update on public.document_templates for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.document_templates for each row execute function private.prevent_org_change();
alter table public.document_templates enable row level security;
revoke all on public.document_templates from anon, authenticated;
grant select, insert, delete on public.document_templates to authenticated;
grant update (name, body, trigger, folder_id, active) on public.document_templates to authenticated;
create policy "members read" on public.document_templates for select to authenticated using (private.is_org_member(organization_id));
create policy "members create" on public.document_templates for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "creator or manager edits" on public.document_templates for update to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.is_org_member(organization_id));
create policy "creator or manager removes" on public.document_templates for delete to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']));

-- Which template wrote a file.
alter table public.office_documents add column template_id uuid references public.document_templates (id) on delete set null;
