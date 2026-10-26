# Status (2026-10-26)

Branch `feat/mvp-foundation`.

## Done

- Foundation, design, Supabase auth (commit `e4f6ce1`).
- Client management: create, list with search (accent-insensitive name/email,
  phone digits) and filters (status, type, follow-up, budget, location,
  archived), detail, edit, archive/restore; dashboard from real data.
  Tested end to end in Chrome against the dev Supabase project.
- Migrations `20261025000000_initial_schema` and `20261026000000_client_search`
  are applied and recorded in `supabase_migrations.schema_migrations`.

## Known gaps / next

- Workspace isolation is tested only in PGlite (`tests/db/rls.test.ts`), not yet
  against the hosted project.
- Supabase advisor: enable leaked password protection (dashboard setting);
  add covering indexes for composite foreign keys when data grows.
- Client page title is generic ("Ügyfél"); no hard delete yet (needs a retention decision).
- Next: properties CRUD, then interactions and tasks.
- Dev tip: don't run `next build` while `next dev` is running; it crashed the dev server once.
