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
- "Mi történt, amíg távol voltál" on the dashboard (`src/lib/away/*`,
  `src/components/dashboard/away-panel.tsx`): unprocessed incoming emails
  since the previous session (30-minute gap = new session; first visit = last
  24 h), a one-line headline, tasks that came due. Mail syncs on open if the
  last sync is older than 5 minutes. The first 3 emails get an AI summary,
  next step and reply draft automatically (others on click), grounded in the
  email plus client data, best matches and the mentioned listing; unknowns
  become [placeholders]. Drafts are stored on the email row (owner-only),
  editable, with Copy and "Megnyitás Gmailben" (prefilled compose, nothing is
  sent). Recipient: Reply-To (now stored by sync), client email, human sender,
  or the one address in a portal email. Tested in Chrome with two seeded test
  emails (`teszt-away-1`, `teszt-away-2`). Migration `20261026182449_away_summary`.
  Drafts are logged as AI operation `next_actions`.
- Sending replies from the CRM (`src/lib/mail/send.ts`, `compose.ts`):
  separate `gmail.send` permission requested only via "Küldés engedélyezése"
  (`/api/mail/google/connect?send=1`), stored as `mailboxes.can_send`. Send
  requires an explicit confirm; blocked while [placeholders] remain or the
  recipient is invalid; 100/day limit. Replies go in the original Gmail thread
  (In-Reply-To/References + threadId), are stored as outgoing emails, logged as
  an interaction on the client (or on the mentioned listing for a new
  inquirer), optionally with a 2-day follow-up task; a client's email is then
  marked processed, a new inquirer's stays in Levelek to be saved as a client.
  Migration `20261026190255_mail_send`. Tested end to end with the owner's
  Gmail: send permission granted, one test reply (to the owner's own address)
  sent, logged on Teszt Kata's timeline with a 2-day follow-up task. Threading
  into a real Gmail conversation is not yet tested (the test email was seeded,
  so the reply started a new conversation).
- The away panel lists new arrivals first, then emails still waiting for a
  reply from before ("korábbi"), so drafts and Send stay reachable.
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
