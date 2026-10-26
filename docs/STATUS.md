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
- Capture (uncommitted, awaiting review): "Rögzítés" page with AI quick
  capture (type or dictate → AI extraction → review screen that never
  overwrites saved data without an explicit tick → one-click save of client
  updates, interaction, follow-up and tasks), manual interaction entry, client
  timeline with AI badge and full note, tasks (create, complete, today /
  overdue / upcoming / done views, dashboard). Tested end to end in Chrome with
  Groq (openai/gpt-oss-120b): extraction, conflict handling, one-click save,
  DB verified. Groq whisper-large-v3 transcription verified with a synthetic
  English clip; Hungarian dictation and the in-browser recorder still need a
  real person to try. Prompt gives the model a 14-day calendar because it got
  weekdays wrong when computing them itself.
- Matching (uncommitted, awaiting review): rule-based client ↔ property
  matching with per-requirement reasons (met / close / miss / no data) and a
  category (Erős / Jó / Lehetséges), never suggesting an owner their own
  property. Shown on client pages ("Illő ingatlanok"), property pages ("Illő
  ügyfelek") and as dashboard suggestions for listings from the last 14 days.
  "Ajánlom" creates a task and stops suggesting the pair; "Nem releváns" hides
  it (decisions in `property_client_matches`). Tested in Chrome; "Nem releváns"
  was not clicked in the browser (needs a second matching pair).
- Migrations `20261025000000_initial_schema`, `20261026000000_client_search` and
  `20261026120126_property_search` and `20261026145340_match_decisions` are applied and recorded in
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
- Next: set an AI key and test capture end to end; then email inbox sync, Android call capture app, matching.
- Dev tip: don't run `next build` while `next dev` is running; it crashed the dev server once.
