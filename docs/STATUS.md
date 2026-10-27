# Status (2026-10-27)

Branch `feat/mvp-foundation`.

## Done

- Launch prep (2026-10-27): `output: "standalone"` + `Dockerfile` (non-root,
  health check on `/api/health`); tested by running the standalone server
  locally (landing, privacy, login, signed-in dashboard, extension download).
  Not built with Docker here (no Docker on this PC). Redirects, OAuth and
  emailed links use `appOrigin()` (`src/lib/origin.ts`, `APP_URL` first) so
  they stay `https://` behind a proxy. Deployment guide: `docs/DEPLOY.md`
  (production Supabase project, OVH + Coolify, DNS, Google, checks).
- Workspace isolation checked on the hosted dev database with
  `supabase/checks/workspace-isolation.sql` (temporary user, always rolls
  back): 0 failures over 16 tables, storage and 6 write paths.
- In-app feedback ("Visszajelzés" in the sidebar, `product_feedback` table):
  bug / idea / other, typed or dictated, with the page it was sent from.
  Agents see only their own; read all of it in the Supabase dashboard.
- Renamed to **Flavio** (domain flavio.hu): app title, logo, landing page,
  shared listing page, privacy policy, and the extension (name, popup,
  badge; version 0.3.0; download folder `flavio-bovitmeny`).
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
- Link-only listing import with media: the agent enters only the link. For
  portals that serve pages to servers (checked: Otthontérkép, Ingatlanbazár,
  Albérlet.hu, Ingatlannet) the CRM opens the page itself
  (`src/lib/listings/fetch-page.ts`: portal hosts only, honest user agent,
  robots.txt respected, redirects re-checked, bot checks never bypassed) and
  finds text, structured data, photos (image-resizer addresses unwrapped to
  originals) and video/virtual-tour links. ingatlan.com and Jófogás block
  servers (Cloudflare / 429): with the extension installed the link opens the
  listing in the browser and the extension sends it back; without it the
  screen explains and offers paste as a fallback. Photos are chosen on the
  review screen and uploaded on the saved listing's page through the normal
  pipeline (resize, no EXIF); server-side ones via `/api/listing-image`
  (signed-in, portal hosts, robots.txt, images ≤ 15 MB), extension ones from
  the CRM tab's IndexedDB (written by `extension/bridge.js`). Video links are
  stored in `properties.features.video_links` and shown on the listing.
  Tested: link-only import from Ingatlannet (data + 3 photos), photo upload
  after save, the blocked-portal message, and the real extension on an
  ingatlan.com listing (all 30 gallery photos at 1920×1080 from the page's
  gallery JSON, YouTube tour link, description copied exactly); after saving,
  all 30 photos uploaded (6.7 MB with previews, cover set) and the browser's
  temporary copies were cleared.
- AI usage per import: the model returns facts plus the first/last words of
  the description (the CRM copies the text between them), ~8 000 characters of
  page text. Groq's free tier allows 8 000 tokens/minute (~2 imports a
  minute); imports wait up to 60 s when Groq asks, chat up to 20 s. For real
  use, a paid tier (Groq Dev tier or Claude Haiku) removes this limit.
- Client-facing listing page (`/l/<token>`, `src/app/l/[token]/page.tsx`,
  `src/lib/shares/*`): "Megosztás" on a listing creates a private link
  (property_shares; one active per listing; contact name/phone/email per link,
  exact address optional; views counted; revocable). Visitors read only
  through `shared_listing()` (no internal notes/owner; address only if
  allowed) and photos via the "shared listings" storage policy; the page uses
  a cookie-less anon client, is noindex, has OG preview, mobile call/email
  bar. Supabase advisor warns that `shared_listing` and
  `shared_media_visible` are callable anonymously: intended.
  `APP_URL` is required in production (the app refuses to build links from the Host header there).
- Offers: "Ajánlom" on a match opens an AI-drafted email to the client
  (`src/lib/offers/draft.ts`: fits first, price within budget as good news,
  one honest miss, CRM words only) with the share link; send from Gmail
  (`sendNewEmail`: logs email + interaction, 2-day follow-up task), open in
  Gmail / copy, or "Csak feladat". Tested: draft, task-only, revoke. Not yet
  tested: actually sending an offer (same path as the tested reply send).
- Extension install card on the import page
  (`src/components/listings/extension-install.tsx`): hidden once the
  extension runs on the page (it keeps checking, so a fresh install is noticed
  without reloading). Detects the browser: Chrome/Edge get "Hozzáadás a
  Chrome-hoz" when `EXTENSION_CHROME_URL` (Chrome Web Store listing) is set,
  else "Bővítmény letöltése" (`/api/extension/download`, a zip of `extension/`
  rewritten to this CRM's address: bridge match and default CRM URL) with
  three steps; Safari/iOS get "Letöltés az App Store-ból" when
  `EXTENSION_SAFARI_URL` is set, else a "coming soon" note. Tested: the
  download (9 files, Windows extracts it, address rewritten), both card
  states rendered. Not done: publishing to the Chrome Web Store and building
  the Safari app (needs a Mac with Xcode and an Apple Developer account).
- Viewings (`viewings` table, `src/lib/viewings/*`, `src/components/viewings/*`):
  "Megtekintés foglalása" on a client or listing, and "Megtekintés" on each
  email in the away summary (highlighted when the AI read a viewing request;
  times the sender proposed become one-click choices, a new inquirer is saved
  as a client, the listing comes from the email or the last interaction).
  Optional Google Calendar event in the agent's primary calendar (separate
  `calendar.events` permission, `mailboxes.can_calendar`; reminders 1 day and
  1 hour before; optional invite to the client sent by Google). Viewings
  booked before the permission are added when it is granted. Move and cancel
  update the event. After the end time, "Hogy sikerült?" asks for the
  reaction (typed or dictated): timeline entry, client–listing relation,
  follow-up task (high: tomorrow, medium: 2 days, no-show: today), and a clear
  "no" stops suggesting the listing. Dashboard shows the next two weeks and
  what waits for feedback. Tested: booking from a client and from an email,
  feedback. Calendar tested 2026-10-27: the event appeared in Google Calendar
  at the right Budapest time and place. If the push fails right after consent
  (e.g. the API is still off), the card says why (`calendar_problem`).
- Reply drafts see the sender's upcoming booked viewings and confirm that
  appointment. Listing features are sent to the AI only when recorded
  (`features_present`, `details`), so an unticked box becomes a placeholder,
  not "no parking". The assistant's `get_property` uses the same rule.
- Chrome Web Store prep: extension icons (from the logo), `npm run
  extension:pack -- https://<address>` (store zip for the production
  address), a public privacy policy at `/adatvedelem` (`PRIVACY_CONTROLLER`,
  `PRIVACY_EMAIL`), and the submission guide `docs/chrome-web-store.md`.
- Quick status change (`property-status-picker.tsx`): the status badge on the
  listing page and in the property list opens a menu of statuses; the change
  shows at once and saves in the background (`setPropertyStatusAction`). The
  menu opens over the page (portal), so table cards can't clip it.
- Gallery polish: fixed-height mosaic (cover + 4, full-size cover, previews
  elsewhere, fade-in loading), editing behind "Fotók kezelése", full-screen
  viewer with blurred placeholder, preloading, thumbnail strip, keys and swipe.
- "Felszereltség és egyéb" (`src/lib/properties/extras.ts`): lift, klíma,
  bútorozott, fűtés, tájolás, kilátás, építés éve, közös költség, stored in
  `properties.features`, editable, shown on the listing. The import fills
  them and bedrooms from the parameter table and the description.
- New owner from the property form (`owner-picker.tsx`,
  `clients/quick-actions.ts`): typed or dictated (transcription + AI fill),
  saved as a client and selected. Typed route tested; dictation not tested
  (needs a microphone).
- Property photos and videos (`src/lib/media/*`, `src/lib/db/media.ts`,
  `src/components/media/property-media.tsx`): private bucket `property-media`,
  files under `<organization>/<property>/`, storage policies check workspace
  membership of the first folder (`private.is_member_of_folder`). Browser
  uploads straight to storage; photos are resized to max 2560 px with a
  640 px preview and lose EXIF (GPS) on the way; videos keep their file and
  get a still-frame preview. Limits: photo originals 40 MB, videos 50 MB
  (Supabase Free per-file limit; raise with the plan), 60 files per listing.
  Gallery: cover (first photo automatically), reorder, delete (files first),
  full-screen viewer. Cover previews in the property list. Tested in Chrome:
  upload, GPS removal, private links, anonymous access refused, delete
  removes files. Not checked at phone width. Not yet: photos from the import
  extension, HEIC (rejected with instructions), video compression.
  Migration `20261026210835_property_media`.
- Listing import (`/properties/import`, `src/lib/listings/*`): paste a listing's
  link and page text, or use the Chrome extension (`extension/`, load
  unpacked). The AI fills the property form from what the page states
  (unknowns stay empty; street parking is not parking); the agent reviews
  and saves; imports start as drafts. `properties.source_url` (canonical,
  unique per workspace) blocks double imports before any AI call. Extension:
  popup reads the active tab on click (listing page → review; profile page →
  list in the CRM with "Már bent van" markers, each listing imported via
  `#crm-import` hand-off). Data reaches the CRM in the address fragment only.
  Balcony/garden/parking are now Van / Nincs / Nincs adat in all property
  forms (unknown no longer saved as "no"). Tested: paste import, fragment
  hand-off, duplicate block, profile list, page reader on stand-in pages.
  Not yet tested: the installed extension on real ingatlan.com pages (the
  portal's Cloudflare check blocks automated visits; the agent's own browser
  passes it). Photos not imported (no photo storage yet). Migration
  `20261026205021_listing_import`. Test listing saved: TESZT-IMP-01.
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

- Supabase advisor: enable leaked password protection (dashboard setting);
  add covering indexes for composite foreign keys when data grows.
- Client page title is generic ("Ügyfél"); no hard delete yet (needs a retention decision).
- Unused index `properties_title_trgm_idx` (superseded) can be dropped.
- Next: Android call capture app; Outlook mailbox; a real inquiry email through Feldolgozás.
- Dev tip: don't run `next build` while `next dev` is running; it crashed the dev server once.
