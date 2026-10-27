# Deploying Flavio

Flavio runs in two places:

- **The app**: a Docker container on an OVH VPS, managed by Coolify. It runs
  the Next.js server.
- **Everything stored**: a production Supabase project (database, sign-in
  and photo storage).

The development Supabase project is never used in production.

The steps below are in order. Expect about two hours the first time.

## 1. Code on GitHub (private)

Coolify deploys from a Git repository.

1. Create a **private** repository on GitHub, e.g. `flavio`.
2. Push the branch you want to deploy, usually `main`, to that repository.

## 2. Production Supabase project

1. **Create a new project** at https://supabase.com/dashboard:
   - name: `flavio-prod`;
   - region: **Central EU (Frankfurt)**, close to the server and to Hungary;
   - database password: a strong one, kept in a password manager.
2. **Apply the schema** from this repository, on your computer:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   `<project-ref>` is in the project URL, `https://<project-ref>.supabase.co`.
   `db push` applies every file in `supabase/migrations/` in order: the
   tables, the RLS policies and the `property-media` storage bucket.
3. **Authentication settings**:
   - **URL Configuration**:
     - Site URL: `https://flavio.hu`.
     - Redirect URLs: `https://flavio.hu/auth/confirm`.
   - **Attack Protection**: turn on **leaked password protection**.
   - **Emails → SMTP Settings**: set up your own SMTP. Supabase's built-in
     sender only delivers to your own team's addresses, a few emails per
     hour, so pilot agents would never get their confirmation email. Brevo
     and Resend both have free plans. Use a sender like `noreply@flavio.hu`,
     after adding the provider's DNS records for flavio.hu.
   - **Emails → Templates** (optional): translate the confirmation and
     password-reset emails into Hungarian.
4. **API keys**: from **Project Settings → API**, copy the project URL and
   the publishable (anon) key. They go into Coolify (step 5).

## 3. Server (OVH VPS + Coolify)

1. **Order the VPS**: VPS-2 (4 vCore, 8 GB), **Ubuntu 24.04**, a European
   location, no paid extras.
2. **Sign in** over SSH with the key or the password OVH emailed you:
   ```bash
   ssh ubuntu@<server-ip>
   ```
3. **Firewall and swap** (swap is a safety net for builds):
   ```bash
   sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw allow 8000 && sudo ufw --force enable
   sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
4. **Install Coolify** (it installs Docker too):
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
   ```
5. **Create the Coolify admin account**: open `http://<server-ip>:8000`
   right away, before anyone else can.

## 4. Domain

At the registrar where you bought flavio.hu, add DNS records:

| Type | Name | Value |
|---|---|---|
| A | `@` (flavio.hu) | `<server-ip>` |
| A | `www` | `<server-ip>` |

They usually take effect within an hour.

## 5. The app in Coolify

1. **Create the resource**: Projects → New → Resource → **Private
   Repository (with GitHub App)**. Connect GitHub, then pick the `flavio`
   repository and the `main` branch.
2. **Build pack**: **Dockerfile**, port **3000**.
3. **Domain**: `https://flavio.hu`. Coolify gets the HTTPS certificate
   itself.
4. **Health check**: path `/api/health`.
5. **Environment variables**: copy the values from your own records. Never
   commit them or paste them into chat. Tick **Build Variable** for the
   ones marked *build*; they are baked into the app when it's built.

| Name | Build? | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build | production project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build | production publishable key |
| `PRIVACY_CONTROLLER` | build | data controller's name and address |
| `PRIVACY_EMAIL` | build | contact email for privacy requests |
| `APP_URL` | | `https://flavio.hu` |
| `ANTHROPIC_API_KEY` or `AI_BASE_URL` + `AI_API_KEY` | | the production AI provider: a paid plan with a data processing agreement, never a free tier, for real clients' data |
| `AI_MODEL` | | the model name |
| `TRANSCRIBE_BASE_URL`, `TRANSCRIBE_API_KEY`, `TRANSCRIBE_MODEL` | | speech-to-text for dictation |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | | the Google OAuth client (step 6) |
| `MAIL_TOKEN_KEY` | | a **new** random key for production. Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `EXTENSION_CHROME_URL`, `EXTENSION_SAFARI_URL` | | store links, once the extension is published |

6. **Deploy**. Later, every push to `main` deploys automatically. If it
   doesn't, turn on "Auto Deploy" in the resource settings.

## 6. Google (Gmail and Calendar)

In Google Cloud Console, in the project of the OAuth client:

1. **Clients → your web client**:
   - Authorized JavaScript origins: add `https://flavio.hu`.
   - Authorized redirect URIs: add
     `https://flavio.hu/api/mail/google/callback`.
2. **Branding**:
   - App name: **Flavio**.
   - Home page: `https://flavio.hu`.
   - Privacy policy: `https://flavio.hu/adatvedelem`.
   - Authorized domain: `flavio.hu`.
3. **Audience → Test users**: add each pilot agent's Gmail address (up to
   100). In testing mode the connection lasts 7 days; see
   [GMAIL_SETUP.md](GMAIL_SETUP.md).

## 7. Check it

1. `https://flavio.hu/api/health` returns `{"ok":true}`.
2. Sign up with your own email. The confirmation email arrives and its link
   goes to flavio.hu.
3. In the production project's SQL editor, run
   `supabase/checks/workspace-isolation.sql`. The last line must be
   `RESULT: 0 failures`. Nothing is saved; it always rolls back.
4. Connect Gmail on the Levelek page.
5. Build the extension for the store with
   `npm run extension:pack -- https://flavio.hu`; see
   [chrome-web-store.md](chrome-web-store.md). Pilot agents can also use
   the download card on the import page.

## Day to day

- **Updates**: push to `main`. Coolify builds the new version and switches
  over when it's healthy.
- **Feedback** from the in-app **Visszajelzés** button is in the
  `product_feedback` table: Supabase → Table Editor, newest first.
- **Logs**: Coolify → the resource → Logs.
- **Database changes**: add a migration file, then run `npx supabase db push`
  against production *before* pushing code that needs it.
