import "server-only";

// Google OAuth (authorization code + PKCE) and the few Gmail API calls we need.
// Reading is the base grant. Sending is a separate grant the user gives only
// when they first send a reply; the CRM never deletes or changes mail.

export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
// Viewings in the agent's own calendar: events only, no access to other calendar settings.
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export class MailAccessRevoked extends Error {}
export class MailSendNotAllowed extends Error {}

/** Where to land after consent: an app path only, never another site. */
export function safeNext(value: string | null) {
  return value && /^\/[a-z][a-z0-9/_-]*$/i.test(value) ? value : "/inbox";
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function googleAuthUrl(p: { redirectUri: string; state: string; codeChallenge: string; send?: boolean; calendar?: boolean }) {
  const config = googleConfig();
  if (!config) throw new Error("Google OAuth is not configured");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: [...GMAIL_SCOPES, ...(p.send ? [GMAIL_SEND_SCOPE] : []), ...(p.calendar ? [CALENDAR_SCOPE] : [])].join(" "),
    access_type: "offline", // returns a refresh token
    prompt: "consent", // always return the refresh token, also on reconnect
    include_granted_scopes: "true",
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; error?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (body.error === "invalid_grant") throw new MailAccessRevoked("Google refresh token is no longer valid");
  if (!res.ok) throw new Error(`Google token endpoint returned ${res.status}${body.error ? ` (${body.error})` : ""}`);
  return body;
}

export async function exchangeCode(code: string, codeVerifier: string, redirectUri: string) {
  const config = googleConfig();
  if (!config) throw new Error("Google OAuth is not configured");
  return tokenRequest({
    code,
    code_verifier: codeVerifier,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(refreshToken: string) {
  const config = googleConfig();
  if (!config) throw new Error("Google OAuth is not configured");
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
}

/** Best effort: revokes the grant at Google so access ends even if our copy leaked. */
export async function revokeToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

export async function gmail<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401) throw new MailAccessRevoked("Gmail rejected the access token");
  if (!res.ok) throw new Error(`Gmail API returned ${res.status} for ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

/** Sends a MIME message (base64url) as the signed-in Gmail user, optionally in an existing thread. */
export async function gmailSend(accessToken: string, raw: string, threadId: string | null) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401) throw new MailAccessRevoked("Gmail rejected the access token");
  if (res.status === 403) throw new MailSendNotAllowed("Gmail refused to send (missing send permission)");
  if (!res.ok) throw new Error(`Gmail send returned ${res.status}`);
  return (await res.json()) as { id: string; threadId: string };
}
