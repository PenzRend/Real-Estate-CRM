# Gmail connection: one-time Google setup

The CRM reads Gmail through Google's official API with **read-only** access
(`gmail.readonly`). Sending replies is a separate permission (`gmail.send`)
that each agent grants only if they want it, the first time they click
**Küldés engedélyezése** on a reply draft. You create the Google "app" once;
every agent then clicks **Levelek → Gmail összekapcsolása**.

## 1. Google Cloud project

1. Open <https://console.cloud.google.com/> and sign in with the Google account
   that will own the app (for example the agency's admin account).
2. Create a project, e.g. **Flavio (dev)**.
3. **APIs & Services → Library**: search for **Gmail API** and click **Enable**.

## 2. Consent screen (Google Auth Platform)

1. **Google Auth Platform → Branding**: app name *Flavio*, your support
   email, developer contact email.
2. **Audience**: user type **External**, publishing status **Testing**.
   Under **Test users**, add every Gmail address that will connect during the
   pilot (up to 100).
3. **Data access**: add the scopes `openid`, `.../auth/userinfo.email`,
   `https://www.googleapis.com/auth/gmail.readonly` and
   `https://www.googleapis.com/auth/gmail.send`.

## 3. OAuth client

1. **Google Auth Platform → Clients → Create client**, type **Web application**.
2. **Authorized redirect URIs**: `http://localhost:3000/api/mail/google/callback`
   (add the production address later, e.g.
   `https://<your-domain>/api/mail/google/callback`).
3. Copy the **Client ID** and **Client secret** into `.env.local`:

   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

   `MAIL_TOKEN_KEY` is already generated in `.env.local`. Keep it stable: if it
   changes, existing mailbox connections can no longer be decrypted and users
   must reconnect.

## 4. Connect

Open **Levelek** in the CRM and click **Gmail összekapcsolása**. Google shows
"Google hasn't verified this app": choose *Continue* (expected in Testing
mode), and tick the Gmail permission. The first sync loads the last 14 days.

To send replies from the CRM, click **Küldés engedélyezése** on any reply draft
on the dashboard and tick the "send email on your behalf" permission. Replies
then go out from the agent's own Gmail (they appear in Sent), in the original
conversation, and only when the agent confirms **Küldés**.

## Limits to know

- **Testing mode:** only the listed test users can connect, and Google expires
  the connection after **7 days**; the CRM then shows *Újracsatlakozás*
  (reconnect). Fine for a pilot.
- **Going public:** `gmail.readonly` is a restricted scope (`gmail.send` is
  "sensitive" and is covered by the same review). Before opening it to
  everyone, the app needs Google verification and a yearly CASA security
  assessment (see docs/COSTS.md). Alternatives: Microsoft 365 (lighter review)
  or a forwarding address.
- **What is stored:** only emails to/from existing clients, from property
  portals, or with a clear property-inquiry subject. Everything else is
  skipped. Tokens are encrypted with `MAIL_TOKEN_KEY`; disconnecting revokes
  access at Google and deletes unprocessed imported emails.
