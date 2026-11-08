-- PROPOSAL, NOT APPLIED: the migration for owner upload links was declined on 2026-11-08.
-- Kept here for review; to use it, move it back into supabase/migrations with a new timestamp.

-- Owners upload a listing's papers themselves: an upload link (/u/<token>)
-- for one listing, valid for 14 days, for the document kinds still missing.
-- The visitor (no sign-in) may only put files into that link's own folder
-- (<org>/<property>/u/<link id>/…, up to 30 files), and a file counts only
-- once register_upload() has checked it and filed it in the listing's
-- checklist (property_documents) in the agent's name.

create table public.upload_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  kinds text[] not null check (kinds <@ array['title_deed', 'energy_certificate', 'floor_plan', 'condo_deed', 'utility_bills', 'other'] and cardinality(kinds) > 0),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete cascade
);
create index upload_links_property_idx on public.upload_links (property_id, organization_id);
alter table public.upload_links enable row level security;
revoke all on public.upload_links from anon, authenticated;
grant select, insert on public.upload_links to authenticated;
grant update (revoked_at) on public.upload_links to authenticated;
create policy "members read" on public.upload_links for select to authenticated using (private.is_org_member(organization_id));
create policy "members create" on public.upload_links for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members revoke" on public.upload_links for update to authenticated
  using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id));

alter table public.property_documents add column upload_link_id uuid references public.upload_links (id) on delete set null;

-- For the storage rule: may an anonymous visitor put this file here? Only
-- into an active link's folder, and not more than 30 files per link.
create function public.upload_link_accepts(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.upload_links l
     where l.id::text = split_part(path, '/', 4)
       and l.organization_id::text = split_part(path, '/', 1)
       and l.property_id::text = split_part(path, '/', 2)
       and split_part(path, '/', 3) = 'u'
       and l.revoked_at is null
       and l.expires_at > now()
       and (select count(*) from public.property_documents d where d.upload_link_id = l.id) < 30
  );
$$;
revoke all on function public.upload_link_accepts(text) from public;
grant execute on function public.upload_link_accepts(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $p$create policy "documents: upload links" on storage.objects for insert to anon
      with check (bucket_id = 'documents' and public.upload_link_accepts(name))$p$;
  end if;
end $$;

-- The upload page: whose listing, which papers are asked for and which have
-- arrived through this link. Null for an unknown, revoked or expired link.
create function public.upload_page(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.upload_links;
begin
  select * into l from public.upload_links where token = p_token and revoked_at is null and expires_at > now();
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'link', l.id,
    'org', l.organization_id,
    'property', l.property_id,
    'title', (select p.title from public.properties p where p.id = l.property_id),
    'agent', (select coalesce(nullif(pr.full_name, ''), 'Az ingatlanos') from public.profiles pr where pr.id = l.created_by),
    'agency', (select o.name from public.organizations o where o.id = l.organization_id),
    'kinds', to_jsonb(l.kinds),
    'expires_at', l.expires_at,
    'received', coalesce((
      select jsonb_agg(jsonb_build_object('kind', d.kind, 'file', d.file_name) order by d.created_at)
      from public.property_documents d where d.upload_link_id = l.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.upload_page(text) from public;
grant execute on function public.upload_page(text) to anon, authenticated;

-- Files an uploaded file in the listing's checklist, after checking that the
-- link is active, the kind was asked for, the file is in the link's folder
-- and really there.
create function public.register_upload(p_token text, p_kind text, p_path text, p_file_name text, p_size bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.upload_links;
begin
  select * into l from public.upload_links where token = p_token and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ez a feltöltési link már nem él.');
  end if;
  if not (p_kind = any (l.kinds)) then
    return jsonb_build_object('ok', false, 'error', 'Ezt a dokumentumot nem kérték.');
  end if;
  if p_path not like l.organization_id::text || '/' || l.property_id::text || '/u/' || l.id::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = p_path)
     or exists (select 1 from public.property_documents d where d.storage_path = p_path) then
    return jsonb_build_object('ok', false, 'error', 'A fájl nem érkezett meg. Próbáld újra.');
  end if;
  insert into public.property_documents (organization_id, property_id, created_by, kind, storage_path, file_name, size_bytes, upload_link_id)
  values (l.organization_id, l.property_id, l.created_by, p_kind, p_path, left(coalesce(nullif(trim(p_file_name), ''), 'dokumentum'), 300), greatest(coalesce(p_size, 0), 0), l.id);
  -- Arrived: no longer "requested".
  delete from public.property_documents
   where property_id = l.property_id and organization_id = l.organization_id and kind = p_kind and mark = 'requested';
  return jsonb_build_object('ok', true, 'agent_id', l.created_by, 'title', (select p.title from public.properties p where p.id = l.property_id));
end;
$$;
revoke all on function public.register_upload(text, text, text, text, bigint) from public;
grant execute on function public.register_upload(text, text, text, text, bigint) to anon, authenticated;
