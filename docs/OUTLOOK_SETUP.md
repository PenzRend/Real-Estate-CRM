# Outlook / Microsoft 365 connection: one-time Microsoft setup

Flavio reads Outlook mail through Microsoft Graph, the same way it reads
Gmail: **reading** is the base permission (`Mail.Read`), **sending**
(`Mail.Send`) and the **calendar** (`Calendars.ReadWrite`) are separate
permissions each agent grants the first time they need them. You register the
Microsoft "app" once; every agent then clicks **Levelek → Outlook / Microsoft
365 összekapcsolása**. It works for work and school accounts (Microsoft 365)
and personal accounts (outlook.com, hotmail.com, live.com).

## 1. Register the app

1. Open <https://entra.microsoft.com/> (or <https://portal.azure.com/> →
   **Microsoft Entra ID**) and sign in with the Microsoft account that will own
   the app (for example the agency's admin account). A free personal Microsoft
   account works too.
2. **Applications → App registrations → New registration**:
   - **Name:** Flavio
   - **Supported account types:** *Accounts in any organizational directory
     (Any Microsoft Entra ID tenant – Multitenant) and personal Microsoft
     accounts*
   - **Redirect URI:** platform **Web**,
     `http://localhost:3000/api/mail/microsoft/callback`
3. Click **Register**. On the **Overview** page copy the **Application (client)
   ID** → `MICROSOFT_CLIENT_ID`.

## 2. Client secret

1. **Certificates & secrets → Client secrets → New client secret**, e.g.
   "Flavio server", expiry 24 months.
2. Copy the **Value** (not the Secret ID) right away → `MICROSOFT_CLIENT_SECRET`.
   It is shown only once.
3. Put a reminder in your calendar for the expiry date: when it runs out,
   Outlook connections stop working until you create a new secret.

## 3. Permissions

**API permissions → Add a permission → Microsoft Graph → Delegated
permissions**, and add:

- `openid`, `email`, `offline_access`, `User.Read`
- `Mail.Read`, `Mail.Send`
- `Calendars.ReadWrite`

Do not add Application permissions: Flavio only acts as the signed-in agent.

## 4. Production address

When Flavio runs on its own domain, **Authentication → Add URI** under the
Web platform: `https://flavio.hu/api/mail/microsoft/callback` (the `APP_URL`
plus `/api/mail/microsoft/callback`). Keep the localhost one for development.

## 5. Environment

In `.env.local` (and on the server):

```
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

`MAIL_TOKEN_KEY` is shared with Gmail; nothing else to set. Restart Flavio,
open **Levelek**: the **Outlook / Microsoft 365 összekapcsolása** button
appears next to Gmail.

## Work accounts and admin consent

Personal Microsoft accounts can connect straight away. Many company Microsoft
365 tenants only let employees approve apps from *verified publishers*, or none
at all. Then the agent sees "Need admin approval", and either:

- the agency's Microsoft 365 admin grants consent once for everyone
  (**Enterprise applications → Flavio → Permissions → Grant admin consent**,
  after the first sign-in attempt), or
- you verify Flavio as a publisher (**Branding & properties → Publisher
  verification**, needs a Microsoft AI Cloud Partner Program ID), which makes
  it approvable by users in most tenants.

## What Flavio does with the access

- **Reading:** lists messages since the last sync and stores only the relevant
  ones (client emails, portal inquiries), like Gmail.
- **Sending:** only when the agent clicks **Küldés**; replies go into the
  original conversation.
- **Calendar:** creates, moves and cancels only the events of viewings booked
  in Flavio; the client gets Outlook's invitation when invited.
- **Disconnecting** (Levelek → Leválasztás) deletes Flavio's copy of the
  tokens. Microsoft has no per-token revocation; the agent can also remove the
  app at <https://myapps.microsoft.com> (work) or
  <https://account.live.com/consent/Manage> (personal).
