-- Listings imported from a portal page remember where they came from, so the
-- same listing can't be imported twice into a workspace.

alter table public.properties
  add column source_url text check (char_length(source_url) <= 500 and source_url ~ '^https://');

create unique index properties_org_source_url_key on public.properties (organization_id, source_url) where source_url is not null;
