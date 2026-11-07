-- Dokumentumok: the office's own folders instead of a fixed list. Each
-- workspace starts with Sablonok, Szerződésminták, Marketing and Irodai ügyek;
-- members add folders, the folder's creator or a manager renames or removes
-- one. A removed folder's files stay, without a folder ("Egyéb").
-- office_documents.folder (the old fixed list) is no longer used.

create table public.office_document_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index office_document_folders_name_key on public.office_document_folders (organization_id, lower(btrim(name)));

create trigger set_updated_at before update on public.office_document_folders for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.office_document_folders for each row execute function private.prevent_org_change();
alter table public.office_document_folders enable row level security;
revoke all on public.office_document_folders from anon, authenticated;
grant select, insert, delete on public.office_document_folders to authenticated;
grant update (name, position) on public.office_document_folders to authenticated;

create policy "members read" on public.office_document_folders for select to authenticated using (private.is_org_member(organization_id));
create policy "members add" on public.office_document_folders for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "creator or manager renames" on public.office_document_folders for update to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.is_org_member(organization_id));
create policy "creator or manager removes" on public.office_document_folders for delete to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']));

alter table public.office_documents add column folder_id uuid references public.office_document_folders (id) on delete set null;
grant update (folder_id) on public.office_documents to authenticated;

-- The starting folders: for every workspace now, and for each new one.
create function private.seed_document_folders(org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.office_document_folders (organization_id, created_by, name, position)
  select org, null, x.name, x.position
  from (values ('Sablonok', 0), ('Szerződésminták', 1), ('Marketing', 2), ('Irodai ügyek', 3)) as x (name, position)
  on conflict do nothing;
$$;
revoke all on function private.seed_document_folders(uuid) from public, anon, authenticated;

select private.seed_document_folders(id) from public.organizations;

create function private.seed_document_folders_for_new_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_document_folders(new.id);
  return new;
end;
$$;
create trigger seed_document_folders after insert on public.organizations for each row execute function private.seed_document_folders_for_new_org();

-- Files already in the fixed folders move to the matching new ones ("Egyéb" stays without a folder).
update public.office_documents d
set folder_id = f.id
from public.office_document_folders f
where f.organization_id = d.organization_id
  and f.name = case d.folder when 'templates' then 'Sablonok' when 'contracts' then 'Szerződésminták' when 'marketing' then 'Marketing' when 'office' then 'Irodai ügyek' end;
