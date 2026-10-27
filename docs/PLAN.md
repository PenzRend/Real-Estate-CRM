# Flavio – MVP terv / MVP plan

Working document for the AI-powered real-estate CRM for Hungarian agents.
Code, identifiers and this document are in English; the UI is Hungarian.

## 1. Current state (2026-10-25)

- The project started from an empty folder. Nothing existed to preserve.
- Scaffolded with `create-next-app`: **Next.js 16.4, React 19.3, TypeScript, Tailwind CSS 4, ESLint**, App Router, `src/` layout.
- Added: `@supabase/supabase-js`, `@supabase/ssr`, `zod`; dev: `supabase` CLI, `vitest`.
- No Docker on this machine → no local Supabase stack. Development uses a **hosted Supabase dev project** (EU region). Migrations live in `supabase/migrations` and are applied with `npx supabase db push`.
- No deployment yet. Vercel is the target once there is something to pilot.
- AI provider: must be **free** for now (see §6).

## 2. Architecture

```
Browser ──► Next.js (Vercel)
             ├─ Server Components: read data with the user's session (RLS applies)
             ├─ Server Actions / Route Handlers: all writes, zod-validated
             └─ src/lib/ai/*: server-only AI calls, schema-validated output
                   │
                   ▼
            Supabase: Postgres + Auth + RLS   (anon key + user JWT only)
```

- **One data path.** All app queries run as the signed-in user through `@supabase/ssr`, so Row Level Security is the authorization boundary, not UI code. The service-role key is never used by the app at runtime; only test setup and admin scripts may use it, never in the browser.
- **Folders:** `src/app` (routes), `src/components` (UI), `src/lib/db` (queries per entity, typed), `src/lib/validation` (zod schemas shared by forms and actions), `src/lib/ai` (provider + prompts), `src/lib/i18n` (Hungarian strings and formatters).
- **No component library dependency up front.** shadcn/ui copies components into the repo; add it when the first forms are built, only the components actually used.
- **Formatting:** `Intl.NumberFormat('hu-HU')` → `80 000 000 Ft`; dates via `Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest' })`. Timestamps stored as `timestamptz` (UTC).

## 3. Authorization model

- Every record belongs to an **organization (workspace)**. There is no per-user ownership path.
- On sign-up a database trigger creates the user's `profile`, a personal organization, and an `owner` membership. An agency is the same thing with more members.
- A user can access a row only if they are a member of the row's `organization_id` (`private.is_org_member()`).
- Roles: `owner`, `admin`, `member`. In the MVP all members can create/read/update; **hard delete** is limited to `owner`/`admin`. Member management UI is out of scope until a pilot agency needs it.
- `organization_id` cannot be changed after insert (trigger), so a user in two workspaces cannot move records between them.
- Cross-tenant references are impossible by construction: child rows use **composite foreign keys** `(client_id, organization_id) → clients(id, organization_id)`, so an interaction in org A cannot point at a client in org B even if someone guesses the UUID.
- `assigned_to` must be a member of the same organization (checked in RLS).
- `anon` gets no table privileges; `authenticated` gets explicit grants, then RLS filters rows.

## 4. MVP schema (first migration)

| Table | Purpose / notes |
|---|---|
| `organizations` | Workspace. |
| `organization_members` | `(organization_id, user_id, role)`, unique per pair. |
| `profiles` | 1:1 with `auth.users`; `full_name`, `email`, `timezone` (default `Europe/Budapest`). |
| `clients` | Contact + status + type; requirements as **explicit columns** because they are filtered and matched on (`budget_min/max`, `preferred_locations text[]`, `preferred_property_types text[]`, `min_rooms`, `min_bedrooms`, `min_area_sqm`, `max_area_sqm`, `preferred_condition`, `desired_move_date`, `other_requirements`), plus `lead_source`, `last_contacted_at`, `next_follow_up_at`, `archived_at`. |
| `properties` | Listing; filterable fields as columns (`city`, `district`, `price`, `currency`, `area_sqm`, `room_count`, `bedroom_count`, `has_balcony`, `has_garden`, `has_parking`, …). `features jsonb` only for the long tail. `owner_client_id` → client. |
| `property_clients` | Links a client to a property with a relation (`interested`, `viewed`, `offered`, `rejected`). |
| `interactions` | Timeline entry: type, `occurred_at`, client and/or property, summary, notes, outcome, `follow_up_required`, `source` (`manual` / `ai_assisted`). |
| `tasks` | Title, status, priority, `due_at`, links to client/property/interaction, `source` (`manual` / `ai_suggestion`). |
| `ai_processing_logs` | Metadata only (operation, entity, status, token counts) for rate limiting and cost tracking. **No note content.** |

Deferred until the feature that needs them: `property_client_matches` (matching is deterministic and computed on demand first; a table is only needed once users can dismiss/mark matches), `ai_suggestions`, property photos (Supabase Storage).

Enumerations are `text` + `check` constraints (easy to extend later without enum migrations).

## 5a. Automation priority (product owner, 2026-10-26)

The main goal is that agents type as little as possible. Information should
flow in from where it already is: portals, email and phone calls. Every source
lands in the same place, the client timeline, and AI turns it into structured
data that the agent confirms rather than types.

| Source | Approach | Why this way |
|---|---|---|
| Call notes, step 1 | Voice memo in the app after a call (phone browser), transcribed and summarized by AI, with fields to confirm | Works on any phone today, no recording consent problem, no telephony change |
| Calls, step 2 | Cloud telephony (virtual number / app) that hands over recordings by webhook → transcript → summary on the client | Only reliable way to capture calls automatically; iOS does not allow call recording and Android restricts it |
| Email, step 1 | A personal forwarding address per workspace; agents forward or auto-forward mail | No Google/Microsoft security review; covers portal inquiry emails too |
| Email, step 2 | Direct Gmail / Microsoft 365 connection (OAuth, read-only) | Gmail read access is a restricted scope: Google verification plus a yearly paid CASA security assessment before public launch |
| Portal leads | Parse the inquiry emails ingatlan.com and others send ("érdeklődés a hirdetésére") into a new lead + interaction | Works without any portal partnership |
| Listings | Official ingatlan.com "Automata betöltés" interface or an export the agent controls | The official listing API is currently not sold to new customers; contact the account manager. No scraping (terms of service, legal risk) |

Calls on a normal SIM card (no number change), researched 2026-10-26:
- Android (Samsung, Xiaomi and others with a built-in recorder): the phone records
  every call itself; our companion app reads the call log and the recordings
  folder (the user grants folder access once) and uploads them automatically.
  Proven pattern (Sell.do, TeleCRM, HelloLeads, Salestrail). Not possible with
  the Google Pixel dialer.
- iPhone: iOS records calls natively with an automatic announcement, but saves
  them to Notes; sending to the CRM is one tap through the share sheet, not
  automatic.
- Cloud switchboard (e.g. One "virtuális alközpont", includes recording):
  fully automatic for any phone, but calls must go through it; whether a mobile
  number can be ported to it needs confirming with the provider.

ingatlan.com listings, researched 2026-10-26:
- Official "Automata betöltés" REST/JSON API (docs at api.ingatlan.com/v1/doc):
  works per agency with their own subscription; not sold to new customers now,
  so ask agencies that already have it and the ingatlan.com account manager
  (a CRM serving many agencies may get a partner deal).
- Without the API: a browser extension that pre-fills ingatlan.com's upload
  form in the agent's own logged-in browser; the agent reviews and publishes.
  Check their terms first; never auto-submit or scrape.
- Importing an agent's own existing listings: AI reads pasted listing text or
  the agent's own listing page via the extension.

Legal: recording calls needs the other party informed (GDPR and the Hungarian
Civil Code's rules on voice recordings); the telephony setup must play or say a
notice. Email and call content is personal data: retention and processor
agreements must be settled before real customers use these features.

## 5. Implementation plan

**Phase 1 – CRM without AI**
1. ✅ Scaffold app, initial migration with RLS (this step).
2. Supabase clients (`server`, `browser`, middleware session refresh), auth pages: sign-up, login, logout, password reset; protected `(app)` route group; Hungarian app shell with sidebar.
3. RLS integration tests: two users in two orgs, prove no cross-org read/insert/update/delete, no org-id change, no cross-org foreign key.
4. Clients: list with search (name/email/phone) and filters, create/edit form, detail page, archive/delete.
5. Properties: same pattern; owner link.
6. Interactions timeline on client/property pages; tasks (today, overdue, per client, complete).
7. Dashboard built only from real queries (today's tasks, overdue, recent interactions, recent properties/clients).
8. Synthetic seed script (Hungarian fake data, clearly marked).

**Phase 2 – AI**
9. Call-note extraction → editable review form → apply chosen fields (never silent overwrite).
10. Deterministic client↔property matching with reasons (satisfied / not satisfied / missing data).
11. Client summary (sourced, dated); next-action suggestions with explanations; accept → task.
12. Assistant with fixed, read-only backend tools scoped to the user's org.

**Phase 3** pilot instrumentation and fixes. Integrations and billing only after validation.

## 6. AI provider (free)

The AI layer talks to an **OpenAI-compatible chat-completions endpoint** configured by env vars, so the provider can be changed without code changes:

| Option | Cost | Notes |
|---|---|---|
| Google Gemini API free tier | Free, rate-limited | Good Hungarian. Check whether free-tier prompts may be used by the provider to improve its products before sending anything but synthetic data. |
| Groq free tier (open models) | Free, rate-limited | Fast; Hungarian quality varies by model. |
| Ollama on your own PC | Free, private | Data never leaves the machine; not reachable from Vercel, slower, weaker on Hungarian. |

Free tiers are fine for development **with synthetic data**. Before real client data is processed, use a tier whose terms exclude training on your data and offer an EU-compatible data processing agreement — that is a GDPR requirement, not a nice-to-have.

All AI output is validated with zod before it is shown; nothing AI-generated is written to client records without user review.

## 7. Environment variables

Put these in `.env.local` yourself (never paste secrets into chat). `.env.example` lists the names.

| Name | Where used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) | browser + server | no (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **tests/scripts only**, never imported by app code | **yes** |
| `AI_BASE_URL` | server | no |
| `AI_API_KEY` | server | **yes** |
| `AI_MODEL` | server | no |

## 8. Risks

- **RLS mistakes are the main security risk.** Mitigated by composite FKs, org-id immutability trigger, explicit grants and automated cross-tenant tests.
- **Free AI tiers and personal data** (see §6). Use synthetic data until a proper provider/DPA is in place.
- **GDPR roles:** the agency is most likely controller, this service the processor; needs a DPA, subprocessor list (Supabase, Vercel, AI provider), retention and deletion rules before the pilot uses real data. Needs legal review.
- **Hosted dev DB only:** migrations are applied to a shared remote DB; keep a separate project for production later.
- **Next.js 16** has breaking changes vs. older docs; follow `node_modules/next/dist/docs`.
- **Product risk:** none of this proves agents will pay. Phase 3 interviews matter more than more features.

## 9. Running locally

```bash
npm install
cp .env.example .env.local   # fill in values
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push         # applies supabase/migrations
npm run dev
```
