-- Photos and videos of properties. Files live in a private storage bucket
-- under <organization_id>/<property_id>/…; this table orders them and marks
-- the cover. Both are visible only to members of the workspace.

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null unique check (char_length(storage_path) <= 300),
  -- A small preview: a downscaled photo, or a still frame of the video.
  thumb_path text check (char_length(thumb_path) <= 300),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/webp', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime')),
  size_bytes bigint not null check (size_bytes > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  duration_seconds numeric(8, 2) check (duration_seconds >= 0),
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Files must sit in this workspace's and this property's folder.
  check (storage_path like organization_id::text || '/' || property_id::text || '/%'),
  check (thumb_path is null or thumb_path like organization_id::text || '/' || property_id::text || '/%'),
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade
);
create index property_media_property_idx on public.property_media (property_id, organization_id, position);
create index property_media_org_idx on public.property_media (organization_id);
-- At most one cover per property.
create unique index property_media_one_cover on public.property_media (property_id) where is_cover;

create trigger set_updated_at before update on public.property_media
  for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.property_media
  for each row execute function private.prevent_org_change();

revoke all on public.property_media from anon, authenticated;
grant select, insert, update, delete on public.property_media to authenticated;
alter table public.property_media enable row level security;

create policy "members read" on public.property_media for select to authenticated
  using (private.is_org_member(organization_id));
create policy "members insert" on public.property_media for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members update" on public.property_media for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
-- Removing a photo is part of editing a listing, so any member may do it.
create policy "members delete" on public.property_media for delete to authenticated
  using (private.is_org_member(organization_id));

-- The first folder of a storage path is a workspace id; members only.
create function private.is_member_of_folder(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_org_member(split_part(path, '/', 1)::uuid)
    else false
  end;
$$;
revoke all on function private.is_member_of_folder(text) from public, anon;
grant execute on function private.is_member_of_folder(text) to authenticated;

-- Storage (skipped where the storage schema doesn't exist, e.g. local tests).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'property-media', 'property-media', false, 52428800,
      array['image/jpeg', 'image/webp', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']
    )
    on conflict (id) do nothing;

    execute $p$create policy "property media: members read" on storage.objects for select to authenticated
      using (bucket_id = 'property-media' and private.is_member_of_folder(name))$p$;
    execute $p$create policy "property media: members upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'property-media' and private.is_member_of_folder(name))$p$;
    execute $p$create policy "property media: members delete" on storage.objects for delete to authenticated
      using (bucket_id = 'property-media' and private.is_member_of_folder(name))$p$;
  end if;
end;
$$;
