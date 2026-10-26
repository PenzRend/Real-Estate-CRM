# Running costs per user (estimate, 2026-10-26)

Rough monthly cost of serving one active agent, to reason about package prices.
Prices are public list prices found on 2026-10-26 and change often; confirm with
each vendor before committing. Exchange-rate assumption: 1 USD ≈ 350 Ft,
1 EUR ≈ 390 Ft. All figures are net (Hungarian prices to customers add 27% ÁFA).

## Usage assumptions (one busy agent, one month)

| Item | Assumption |
|---|---|
| Phone calls captured | 300 calls × 3 min = 900 min of audio |
| Emails processed | 600 (incoming + outgoing) |
| AI assistant questions / summaries | 200 |

Change these first if pilot data says otherwise; every AI and transcription
line scales with them.

## Variable cost per user

| Component | Option | Unit price | Per user / month |
|---|---|---|---|
| Transcription (calls → text) | OpenAI / AssemblyAI / Deepgram class APIs | ≈ $0.003–0.008 / min | **$3–7** (≈ 1 000–2 500 Ft) |
| AI extraction and summaries | Claude Haiku 5.5 for bulk ($0.10 in / $0.50 out per M tokens) | ~4.6M in, 0.5M out | **≈ $0.7** (≈ 250 Ft) |
| | Claude Sonnet 5.5 for everything ($2 / $10) | same | ≈ $14 (≈ 5 000 Ft) |
| | Mixed: Haiku for calls/emails, Sonnet for the assistant | | **≈ $5** (≈ 1 800 Ft) |
| Email connection | Unipile (11–50 accounts) | €5 / account | **€5** (≈ 2 000 Ft) |
| | Nylas | ≈ $2–5 / account | $2–5 (≈ 700–1 800 Ft) |
| | Own Gmail/Outlook integration | $0 per account, but Gmail needs a yearly paid security assessment (see fixed costs) | $0 |
| Call capture | Own Android companion app using the phone's built-in recorder | $0 (development cost only) | **$0** |
| | Third-party call-sync app (e.g. Salestrail) | ≈ $3.5–10.5 + recording add-on | $5–15 (≈ 1 800–5 300 Ft) |
| | Cloud phone system (virtual number / switchboard) | from ≈ $18–30 / user + call minutes | $25–45 (≈ 9 000–16 000 Ft) |
| Recording storage | 900 min ≈ 0.2–0.5 GB / month, grows with retention | ≈ $0.02 / GB | < $0.05 |

## Fixed monthly costs (shared by all users)

| Item | Monthly |
|---|---|
| Supabase Pro (database, auth, storage) | from $25 + usage |
| Vercel Pro (hosting) | $20 per developer seat |
| Transactional email (auth mails, notifications) | $0–20 |
| Error monitoring, backups, domain | $0–30 |
| Gmail restricted-scope security assessment (CASA), only for direct Gmail sync | a few hundred to a few thousand $ / year |
| **Total** | **≈ $70–150 / month** before CASA |

Spread over users: ≈ $3–7 each at 20 users, ≈ $1 each at 100 users.

## Cost per user by package (variable + share of fixed at ~50 users)

| Package | Contents | Cost / user / month |
|---|---|---|
| **Alap** | CRM, AI notes from typed or dictated memos, portal leads by forwarded email | ≈ $3–5 → **≈ 1 000–1 800 Ft** |
| **Pro** | Alap + mailbox sync + automatic call capture (Android app) with transcripts and summaries | ≈ $13–20 → **≈ 4 500–7 000 Ft** |
| **Pro + telefonközpont** | Pro + cloud phone number with recording for any phone | ≈ $40–65 → **≈ 14 000–23 000 Ft** |

Against the 19 900 Ft hypothesis: Alap and Pro leave healthy margin (support,
payment fees, sales, development are not included above); the cloud-phone tier
needs its own price or a pass-through of the telephony fee.

## Not included

Development time, customer support, payment processing fees (card payments in
the EEA are roughly 1.5% + a fixed fee), legal review (GDPR, processor
agreements), marketing, and taxes.

## Sources

- AI model prices: Anthropic API pricing (Claude Haiku 5.5, Sonnet 5.5), cached 2026-10-06
- Transcription: https://dev.to/eli_9c82b7dfe52c1bc371ffe/ai-transcription-pricing-2026-whisper-vs-deepgram-vs-assemblyai-2eec , https://soniox.com/compare/stt/pricing
- Email APIs: https://www.unipile.com/pricing/ , https://nylas.com/pricing/
- Call sync app: https://www.capterra.com/p/182030/Salestrail/ , https://softwarefinder.com/call-center/salestrail
- Cloud phone systems: https://subger.com/hu/service/aircall-voip , https://subger.com/hu/service/callhippo
- Gmail assessment: https://deepstrike.io/blog/google-casa-security-assessment-2025
