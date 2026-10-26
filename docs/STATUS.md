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
- Email (uncommitted, awaiting review): Gmail connect (OAuth + PKCE,
  read-only scope, tokens AES-256-GCM encrypted), on-demand + stale-inbox sync
  that stores only client / portal / inquiry emails, "Levelek" inbox, and
  "Feldolgozás" that runs the email through AI capture (portal inquirer becomes
  the client; listing-derived fields unticked; mentioned listing auto-linked).
  Email → capture → new client tested end to end with a seeded synthetic
  ingatlan.com email. Real Gmail connect (Google OAuth, testing mode),
  encrypted token storage, first sync and manual sync tested with the
  owner's Gmail. Portal price alerts / saved searches / newsletters are now
  skipped (a price alert was stored before this fix). Still untested: a real
  inquiry email from Gmail through Feldolgozás (needs a test email sent).
  A placeholder test mailbox (teszt-postafiok@example.test, revoked) exists.
- AI assistant (`/assistant`): answers questions about clients, properties,
  tasks, interactions, emails and matches using read-only tools only
  (`src/lib/assistant/tools.ts`), cites every claim as `[S1]`, shown as
  numbered chips plus a "Források" list linking to the records. The first
  step must call a tool (falls back if Groq rejects a forced call, e.g. when
  declining a request). Retries briefly on a 429 with `retry-after`.
  Name search tolerates Hungarian suffixes ("Katáról"). It declines writes
  and sending, pointing only to real features. Conversations are not stored;
  only usage metadata (operation `assistant`). Tested in Chrome: client and
  match question (parking flagged as missing), send-email refusal, no-data
  answer. Groq's free tier can hit its per-minute token limit on multi-step
  questions.
- Public landing page at `/` (`src/app/page.tsx`, static): hero, product
  illustrations labelled "Példa", features, how it works, security, roadmap
  ("Hamarosan"), FAQ, CTA to `/signup`. No invented reviews, customer counts
  or prices. Signed-in visitors are redirected to `/dashboard` by the proxy.
- Day expressions ("kedden", "jövő kedden", "holnapután"…) are resolved in
  code and given to the model as a lookup table.
- Migrations `20261025000000_initial_schema`, `20261026000000_client_search` and
  `20261026120126_property_search` and `20261026145340_match_decisions` and `20261026150621_email_sync` are applied and recorded in
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
- Next: Android call capture app; Outlook mailbox; a real inquiry email through Feldolgozás.
- Dev tip: don't run `next build` while `next dev` is running; it crashed the dev server once.
