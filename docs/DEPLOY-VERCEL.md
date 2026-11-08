# Deploying Flavio for free (pilot)

For a free pilot with a few agents, Flavio can run at no cost:

- **The app**: Vercel's free (Hobby) plan, in Frankfurt.
- **Scheduled jobs**: cron-job.org (free) calls the app every 2 minutes and
  every morning.
- **Everything stored**: a second, free Supabase project for production.

Vercel's free plan is for **non-commercial use only**. Once agents pay for
Flavio, move to Vercel Pro or to the server in [DEPLOY.md](DEPLOY.md);
nothing in the code is tied to Vercel.

The steps below are in order. Expect about an hour the first time.

## 1. Production Supabase project

The development project is never used in production.

1. **Create a new project** at https://supabase.com/dashboard:
   - name: `flavio-prod`;
   - region: **Central EU (Frankfurt)**;
   - database password: a strong one, kept in a password manager.
2. **Apply the schema** from this repository, on your computer:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   `<project-ref>` is in the project URL, `https://<project-ref>.supabase.co`.
3. **API keys**: from **Project Settings → API Keys**, note the project URL,
   the publishable key and the **secret** key. They go into Vercel (step 3).

Authentication settings come in step 4, once the app has its address.

## 2. Code on GitHub

Vercel deploys from GitHub. Push the branch you deploy, currently
`feat/mvp-foundation`.

## 3. The app on Vercel

1. **Sign up** at https://vercel.com with your GitHub account (Hobby plan).
2. **Add New → Project**, pick the `Real-Estate-CRM` repository.
   - If Vercel says repositories of a GitHub organization need a paid plan,
     deploy from your computer instead: `npx vercel` once to link the folder,
     then `npx vercel --prod` for each new version.
3. **Framework**: Next.js (detected). Leave the build settings as they are.
4. **Environment variables**: copy the values from your own records. Never
   commit them or paste them into chat.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | production project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production publishable key |
| `SUPABASE_SECRET_KEY` | production secret key: turns on notifications, automatic emails and the morning jobs |
| `APP_URL` | the app's address, e.g. `https://flavio-xyz.vercel.app`. Required. Fill in after the first deploy if you don't know it yet, then redeploy |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | the AI provider. Free tiers are fine with test data only; for real clients' data use a paid plan with a data processing agreement |
| `AI_FALLBACK_BASE_URL`, `AI_FALLBACK_API_KEY`, `AI_FALLBACK_MODEL` | optional backup provider |
| `TRANSCRIBE_MODEL` (and `TRANSCRIBE_BASE_URL`, `TRANSCRIBE_API_KEY` if separate) | speech-to-text for dictation |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the Google OAuth client (step 5) |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | only if Outlook is used |
| `MAIL_TOKEN_KEY` | a **new** random key for production: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `CRON_SECRET` | a **new** random key, made the same way. cron-job.org sends it (step 6) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | phone notifications (see `.env.example`) |
| `PRIVACY_CONTROLLER`, `PRIVACY_EMAIL` | for the privacy page |
| `ADMIN_EMAILS` | your own address: opens **/admin**, where you make sign-up codes and set AI caps |
| `AI_MONTHLY_LIMIT` | AI calls each workspace may make in a month, e.g. `500`. Empty: no monthly cap |
| `AI_DAILY_LIMIT` | AI calls each workspace may make in a day. Empty: `100`. Groq's free tier allows about 1,000 requests a day for everyone together |

5. **Deploy**. The region is set to Frankfurt by `vercel.json`. Keep
   **Fluid compute** on (Settings → Functions); it is on by default and gives
   the AI requests enough time.
6. **Production branch**: Settings → Git → set it to the branch you deploy.
   From then on, every push to it deploys.

## 4. Supabase sign-in settings

In the production project, **Authentication**:

- **URL Configuration**:
  - Site URL: the `APP_URL` value.
  - Redirect URLs: `<APP_URL>/auth/confirm`.
- **Attack Protection**: turn on **leaked password protection**.
- **Emails → SMTP Settings**: set up your own SMTP (Brevo and Resend have free
  plans). Supabase's built-in sender only reaches your own team, a few emails
  an hour, so pilot agents would never get their confirmation email.

## 5. Google (Gmail and Calendar)

In Google Cloud Console, in the project of the OAuth client:

- Authorized JavaScript origins: add the `APP_URL` value.
- Authorized redirect URIs: add `<APP_URL>/api/mail/google/callback`.
- Audience → Test users: add each pilot agent's Gmail address.

For Outlook, add `<APP_URL>/api/mail/microsoft/callback` in the Microsoft app
registration (see [OUTLOOK_SETUP.md](OUTLOOK_SETUP.md)).

## 6. Scheduled jobs (cron-job.org)

1. **Sign up** at https://cron-job.org (free).
2. **Create two cronjobs**. For each, under **Advanced → Headers**, add
   `Authorization` with the value `Bearer <CRON_SECRET>`.

| Title | URL | Schedule |
|---|---|---|
| Flavio – levelek | `<APP_URL>/api/cron?job=mail` | every 2 minutes |
| Flavio – reggel | `<APP_URL>/api/cron?job=daily` | every day at 7:00, time zone Europe/Budapest |

`mail` checks the mailboxes, sends the automatic emails and the "Hogy
sikerült?" prompts. `daily` sends the morning summary, the viewing reminders
and the reports. Each run's result shows in cron-job.org's history; a `401`
means the header doesn't match `CRON_SECRET`.

The 2-minute job also keeps the free Supabase project from pausing for
inactivity.

## 7. Check it

1. `<APP_URL>/api/health` returns `{"ok":true}`.
2. Sign up with your own email. The confirmation email arrives and its link
   goes to `APP_URL`.
3. In the production project's SQL editor, run
   `supabase/checks/workspace-isolation.sql`. The last line must be
   `RESULT: 0 failures`. Nothing is saved; it always rolls back.
4. Connect Gmail on the Levelek page.
5. In cron-job.org, both jobs show a successful run.

## Inviting pilot agents

New accounts need a sign-up code; only people invited into an existing team
skip it. On **/admin** (Settings → Pilot admin):

1. **Új kód**: write who it is for, optionally lock it to their email address.
2. Send the link (`<APP_URL>/signup?code=…`) with **Küldés e-mailben**, or
   copy it. Each code works once and for 60 days.
3. The list shows who used which code. Revoke a code that was not used yet.

The same page shows each workspace's AI calls this month. A number typed next
to a workspace replaces `AI_MONTHLY_LIMIT` for it; empty goes back to the
default. Over the cap, the AI features say so until the month ends.

Your own first account also needs a code. Before you have one, make it in the
production project's SQL editor:

```sql
insert into public.signup_codes (code, note) values ('ADMN-0001', 'Saját fiók');
```

## Day to day

- **Updates**: push to the production branch; Vercel builds and switches over.
- **Database changes**: run `npx supabase db push` against production
  *before* pushing code that needs it.
- **Logs**: Vercel → the project → Logs.
- **Feedback** from the **Visszajelzés** button is in the `product_feedback`
  table.
