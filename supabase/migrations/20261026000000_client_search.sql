-- Client search: accent-insensitive text ("Peter" finds "Péter") and
-- digits-only phone matching ("301234567" finds "+36 30 123 4567").

create extension if not exists unaccent with schema extensions;

-- Immutable wrappers so they can back generated columns and indexes.
-- (unaccent with an explicit dictionary does not depend on search_path.)
create function private.normalize_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')));
$$;

create function private.normalize_search(items text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select private.normalize_search(array_to_string(items, ' '));
$$;

grant execute on function private.normalize_search(text), private.normalize_search(text[]) to authenticated;

alter table public.clients
  add column search_text text generated always as (
    private.normalize_search(full_name || ' ' || coalesce(email, ''))
  ) stored,
  add column phone_digits text generated always as (
    regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  ) stored,
  add column locations_text text generated always as (
    private.normalize_search(preferred_locations)
  ) stored;

create index clients_search_text_trgm_idx on public.clients using gin (search_text extensions.gin_trgm_ops);
create index clients_phone_digits_trgm_idx on public.clients using gin (phone_digits extensions.gin_trgm_ops);
create index clients_locations_text_trgm_idx on public.clients using gin (locations_text extensions.gin_trgm_ops);

-- Superseded by the indexes above.
drop index public.clients_full_name_trgm_idx;
drop index public.clients_email_trgm_idx;
drop index public.clients_phone_trgm_idx;
