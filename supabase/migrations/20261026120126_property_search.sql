-- Property search: one accent-insensitive column over the fields agents type
-- into the search box ("ors vezer" finds "Örs vezér tere", "bp11-024" the reference).
-- Additive only; properties_title_trgm_idx is now unused and can be dropped later.

alter table public.properties
  add column search_text text generated always as (
    private.normalize_search(
      title || ' ' || coalesce(reference_number, '') || ' ' || coalesce(city, '') || ' ' ||
      coalesce(district, '') || ' ' || coalesce(address, '') || ' ' || coalesce(postal_code, '')
    )
  ) stored;

create index properties_search_text_trgm_idx on public.properties using gin (search_text extensions.gin_trgm_ops);

-- Owner lookups from the client page use the composite foreign key.
create index properties_owner_client_org_idx on public.properties (owner_client_id, organization_id);
