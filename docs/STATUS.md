# Status (2026-10-26)

Branch `feat/mvp-foundation`.

## Done

- Foundation, design, Supabase auth (commit `e4f6ce1`).
- Client management: create, list with search (accent-insensitive name/email,
  phone digits) and filters (status, type, follow-up, budget, location,
  archived), detail, edit, archive/restore; dashboard from real data.
  Tested end to end in Chrome against the dev Supabase project.
- Property management: create, list with search and filters (type, sale/rent,
  status, price, rooms, size, balcony/garden/parking, archived), detail with
  price per m², owner link, edit, archive/restore; client pages list owned
  properties. Tested end to end in Chrome.
- Migrations `20261025000000_initial_schema`, `20261026000000_client_search` and
  `20261026120126_property_search` are applied and recorded in
  `supabase_migrations.schema_migrations`.
- Supabase MCP `apply_migration` auto-declines migrations with DROP statements
  here; keep migrations additive (drop old indexes later, with the user).

## Known gaps / next

- Workspace isolation is tested only in PGlite (`tests/db/rls.test.ts`), not yet
  against the hosted project.
- Supabase advisor: enable leaked password protection (dashboard setting);
  add covering indexes for composite foreign keys when data grows.
- Client page title is generic ("Ügyfél"); no hard delete yet (needs a retention decision).
- Unused index `properties_title_trgm_idx` (superseded) can be dropped.
- Next: interactions (call notes) and tasks.
- Dev tip: don't run `next build` while `next dev` is running; it crashed the dev server once.
