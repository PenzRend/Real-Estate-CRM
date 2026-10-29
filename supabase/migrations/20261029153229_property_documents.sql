-- The documents a listing needs (title deed, energy certificate, the signed
-- listing agreement, floor plan…): files in a private bucket under the
-- workspace's folder, and the checklist state per kind ("not needed",
-- "asked the owner on …").

create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null check (kind in ('title_deed', 'energy_certificate', 'agency_agreement', 'floor_plan', 'condo_deed', 'utility_bills', 'other')),
  -- A file, or a checklist mark without one.
  storage_path text check (char_length(storage_path) <= 500),
  file_name text check (char_length(file_name) <= 300),
  size_bytes bigint check (size_bytes >= 0),
  mark text check (mark in ('not_needed', 'requested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((storage_path is null) <> (mark is null)),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete cascade
);
create index property_documents_property_idx on public.property_documents (property_id, organization_id, kind);
create unique index property_documents_mark_idx on public.property_documents (property_id, kind) where mark is not null;

create trigger set_updated_at before update on public.property_documents for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.property_documents for each row execute function private.prevent_org_change();
revoke all on public.property_documents from anon, authenticated;
grant select, insert, update, delete on public.property_documents to authenticated;
alter table public.property_documents enable row level security;
create policy "members read" on public.property_documents for select to authenticated using (private.is_org_member(organization_id));
create policy "members insert" on public.property_documents for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members update" on public.property_documents for update to authenticated
  using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id));
create policy "members delete" on public.property_documents for delete to authenticated using (private.is_org_member(organization_id));

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'documents', 'documents', false, 20971520,
      array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
    )
    on conflict (id) do nothing;

    execute $p$create policy "documents: members read" on storage.objects for select to authenticated
      using (bucket_id = 'documents' and private.is_member_of_folder(name))$p$;
    execute $p$create policy "documents: members upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'documents' and private.is_member_of_folder(name))$p$;
    execute $p$create policy "documents: members delete" on storage.objects for delete to authenticated
      using (bucket_id = 'documents' and private.is_member_of_folder(name))$p$;
  end if;
end;
$$;
