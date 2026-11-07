-- Two things for the whole office:
-- 1. Üzenetek: a chat with one office-wide channel (recipient_id null) and
--    one-to-one conversations (recipient_id set). Members read the office
--    channel and only their own direct messages; new messages arrive live
--    (Supabase Realtime, which applies the same RLS).
-- 2. Dokumentumok: the office's shared files (contract templates, price
--    lists, marketing material…) in the private "documents" bucket under
--    "<workspace>/office/". Every member reads and uploads; the uploader or a
--    manager edits and removes.

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  recipient_id uuid references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (recipient_id is null or recipient_id <> sender_id)
);
create index chat_messages_office_idx on public.chat_messages (organization_id, created_at desc) where recipient_id is null;
create index chat_messages_direct_idx on public.chat_messages (organization_id, recipient_id, sender_id, created_at desc) where recipient_id is not null;

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant select, insert, delete on public.chat_messages to authenticated;

create policy "members read their conversations" on public.chat_messages for select to authenticated
  using (
    private.is_org_member(organization_id)
    and (recipient_id is null or sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  );
create policy "members write" on public.chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and (
      recipient_id is null
      or exists (select 1 from public.organization_members m where m.organization_id = chat_messages.organization_id and m.user_id = chat_messages.recipient_id)
    )
  );
create policy "senders delete own" on public.chat_messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- How far each member has read each conversation ("office", or the other member's id).
create table public.chat_reads (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  peer text not null check (peer = 'office' or peer ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  last_read_at timestamptz not null default now(),
  primary key (user_id, organization_id, peer)
);
alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from anon, authenticated;
grant select, insert, update on public.chat_reads to authenticated;
create policy "own read markers" on public.chat_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));

-- Unread messages per conversation for the signed-in member (RLS applies).
create function public.chat_unread(p_org uuid)
returns table (peer text, unread bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select case when m.recipient_id is null then 'office' else m.sender_id::text end as peer, m.created_at
    from public.chat_messages m
    where m.organization_id = p_org
      and m.sender_id <> (select auth.uid())
      and (m.recipient_id is null or m.recipient_id = (select auth.uid()))
  )
  select mine.peer, count(*)
  from mine
  left join public.chat_reads r on r.user_id = (select auth.uid()) and r.organization_id = p_org and r.peer = mine.peer
  where mine.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by mine.peer;
$$;
revoke all on function public.chat_unread(uuid) from public, anon;
grant execute on function public.chat_unread(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;

create table public.office_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  folder text not null default 'general' check (folder in ('templates', 'contracts', 'marketing', 'office', 'general')),
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null unique check (char_length(storage_path) <= 500),
  file_name text not null check (char_length(file_name) <= 300),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  mime_type text check (char_length(mime_type) <= 200),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_documents_org_idx on public.office_documents (organization_id, folder, created_at desc);

create trigger set_updated_at before update on public.office_documents for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.office_documents for each row execute function private.prevent_org_change();
alter table public.office_documents enable row level security;
revoke all on public.office_documents from anon, authenticated;
grant select, insert, delete on public.office_documents to authenticated;
grant update (title, folder, pinned) on public.office_documents to authenticated;

create policy "members read" on public.office_documents for select to authenticated using (private.is_org_member(organization_id));
create policy "members upload" on public.office_documents for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "uploader or manager edits" on public.office_documents for update to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.is_org_member(organization_id));
create policy "uploader or manager removes" on public.office_documents for delete to authenticated
  using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']));

-- The office library also holds spreadsheets, presentations and plain text.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    update storage.buckets
    set allowed_mime_types = array(
      select distinct unnest(coalesce(allowed_mime_types, '{}') || array[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
      ])
    )
    where id = 'documents';
  end if;
end;
$$;
