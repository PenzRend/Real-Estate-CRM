-- Usernames, profile pictures, and richer chat:
-- * profiles.username: unique, lowercase (a–z, 0–9, "." and "_", 3–30), used
--   for @mentions. Existing users get one from their email; new users get one
--   by the trigger below; anyone can change theirs in Beállítások.
-- * profiles.avatar_path: a picture in the public "avatars" bucket, under the
--   user's own folder (random file names, so the URL can't be guessed).
-- * chat_messages may carry a record (a client, listing or deal) shared into
--   the conversation, with or without text, and remember when the mentioned
--   or addressed members were notified on their phones.

alter table public.profiles add column username text, add column avatar_path text check (char_length(avatar_path) <= 300);

create function private.unique_username(base text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  stem text := left(regexp_replace(lower(translate(coalesce(base, ''), 'áéíóöőúüűÁÉÍÓÖŐÚÜŰ', 'aeiooouuuAEIOOOUUU')), '[^a-z0-9._]+', '', 'g'), 24);
  candidate text;
  i int := 0;
begin
  if char_length(stem) < 3 then
    stem := stem || 'flavio';
  end if;
  candidate := stem;
  while exists (select 1 from public.profiles where username = candidate) loop
    i := i + 1;
    candidate := stem || i;
  end loop;
  return candidate;
end;
$$;
revoke all on function private.unique_username(text) from public, anon, authenticated;

update public.profiles set username = private.unique_username(split_part(email, '@', 1)) where username is null;

alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9._]{3,30}$');
create unique index profiles_username_key on public.profiles (username);

create function private.set_default_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username is null then
    new.username := private.unique_username(split_part(new.email, '@', 1));
  end if;
  return new;
end;
$$;
create trigger set_default_username before insert on public.profiles for each row execute function private.set_default_username();

grant update (username, avatar_path) on public.profiles to authenticated;

-- Whether a username is free (another user's profile is not readable, so ask here).
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9._]{3,30}$'
    and not exists (select 1 from public.profiles where username = p_username and id <> (select auth.uid()));
$$;
revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$create policy "avatars: own folder upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)$p$;
    execute $p$create policy "avatars: own folder delete" on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)$p$;
  end if;
end;
$$;

-- A record shared into the chat, and phone notifications.
alter table public.chat_messages
  add column ref_kind text check (ref_kind in ('client', 'property', 'deal')),
  add column ref_id uuid,
  add column notified_at timestamptz;
alter table public.chat_messages add constraint chat_messages_ref check ((ref_kind is null) = (ref_id is null));
alter table public.chat_messages drop constraint chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check
  check (char_length(body) <= 4000 and (char_length(body) >= 1 or ref_kind is not null));
create index chat_messages_unnotified_idx on public.chat_messages (created_at) where notified_at is null;
