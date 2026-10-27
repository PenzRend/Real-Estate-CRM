import "server-only";
import { MailAccessRevoked, MailSendNotAllowed } from "./google";

// Microsoft identity platform (authorization code + PKCE, "common" tenant: work
// and school accounts and personal outlook.com / hotmail accounts) and the few
// Microsoft Graph calls Flavio needs. Like Gmail: reading is the base grant,
// sending and the calendar are separate grants given when first needed.

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0/me";

export const OUTLOOK_SCOPES = ["openid", "email", "offline_access", "User.Read", "Mail.Read"];
export const OUTLOOK_SEND_SCOPE = "Mail.Send";
export const OUTLOOK_CALENDAR_SCOPE = "Calendars.ReadWrite";

// Message ids that stay the same when a message moves between folders (e.g. a
// sent draft moving to Sent Items), so a sent reply is not stored twice.
const IMMUTABLE_IDS = 'IdType="ImmutableId"';

export function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function microsoftScopes(p: { send?: boolean; calendar?: boolean }) {
  return [...OUTLOOK_SCOPES, ...(p.send ? [OUTLOOK_SEND_SCOPE] : []), ...(p.calendar ? [OUTLOOK_CALENDAR_SCOPE] : [])];
}

export function microsoftAuthUrl(p: { redirectUri: string; state: string; codeChallenge: string; send?: boolean; calendar?: boolean; loginHint?: string | null }) {
  const config = microsoftConfig();
  if (!config) throw new Error("Microsoft OAuth is not configured");
  const url = new URL(`${AUTHORITY}/authorize`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: microsoftScopes(p).join(" "),
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    // A first connection lets the agent pick the account; adding a permission stays on the connected one.
    ...(p.loginHint ? { login_hint: p.loginHint } : { prompt: "select_account" }),
  }).toString();
  return url.toString();
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; error?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (body.error === "invalid_grant" || body.error === "interaction_required") throw new MailAccessRevoked("Microsoft refresh token is no longer valid");
  if (!res.ok) throw new Error(`Microsoft token endpoint returned ${res.status}${body.error ? ` (${body.error})` : ""}`);
  return body;
}

export async function exchangeMicrosoftCode(code: string, codeVerifier: string, redirectUri: string, scopes: string[]) {
  const config = microsoftConfig();
  if (!config) throw new Error("Microsoft OAuth is not configured");
  return tokenRequest({
    code,
    code_verifier: codeVerifier,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: scopes.join(" "),
  });
}

/** Microsoft rotates refresh tokens: the response carries a new one to store. */
export async function refreshMicrosoftToken(refreshToken: string) {
  const config = microsoftConfig();
  if (!config) throw new Error("Microsoft OAuth is not configured");
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
}

/** Granted scopes as short names ("Mail.Read"), whatever form the token response uses. */
export function grantedScopes(scope: string | undefined) {
  return new Set((scope ?? "").split(" ").map((s) => s.replace(/^https:\/\/graph\.microsoft\.com\//i, "").toLowerCase()));
}

export class GraphNotAllowed extends Error {}

/** One Graph call as the signed-in user. Null for 202/204 and for something already gone (404). */
export async function graph<T>(path: string, accessToken: string, init: { method?: string; body?: unknown; textBody?: boolean } = {}): Promise<T | null> {
  const url = path.startsWith("https://") ? path : path.startsWith("?") ? `${GRAPH}${path}` : `${GRAPH}/${path}`;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: [IMMUTABLE_IDS, ...(init.textBody ? ['outlook.body-content-type="text"'] : [])].join(", "),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401) throw new MailAccessRevoked("Microsoft Graph rejected the access token");
  if (res.status === 403) throw new GraphNotAllowed(`Microsoft Graph refused ${path.split("?")[0]}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Microsoft Graph returned ${res.status} for ${path.split("?")[0]}`);
  if (res.status === 202 || res.status === 204) return null;
  return (await res.json()) as T;
}

type GraphAddress = { emailAddress?: { address?: string; name?: string } };
export type GraphMessage = {
  id: string;
  conversationId?: string;
  receivedDateTime?: string;
  subject?: string;
  bodyPreview?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  replyTo?: GraphAddress[];
  body?: { contentType?: string; content?: string };
};

const META_FIELDS = "id,conversationId,receivedDateTime,subject,bodyPreview,from,toRecipients,ccRecipients,replyTo";

export const graphAddress = (a: GraphAddress | undefined) => {
  const email = a?.emailAddress?.address?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email, name: a?.emailAddress?.name?.trim() || null } : null;
};

/** Messages received (or sent) since a moment, newest first, across folders; drafts left out. */
export async function listOutlookMessages(accessToken: string, since: Date, max: number): Promise<GraphMessage[]> {
  const out: GraphMessage[] = [];
  const filter = encodeURIComponent(`receivedDateTime ge ${since.toISOString()} and isDraft eq false`);
  let next: string | null = `messages?$filter=${filter}&$orderby=receivedDateTime desc&$top=100&$select=${META_FIELDS}`;
  while (next && out.length < max) {
    const page: { value?: GraphMessage[]; "@odata.nextLink"?: string } | null = await graph(next, accessToken);
    out.push(...(page?.value ?? []));
    next = page?.["@odata.nextLink"] ?? null;
  }
  return out;
}

/** A message's body as plain text (Graph converts HTML when asked). */
export async function outlookBody(accessToken: string, id: string) {
  const m = await graph<GraphMessage>(`messages/${encodeURIComponent(id)}?$select=body`, accessToken, { textBody: true });
  return m?.body?.content ?? "";
}

export async function outlookProfile(accessToken: string) {
  const me = await graph<{ mail?: string | null; userPrincipalName?: string }>("?$select=mail,userPrincipalName", accessToken);
  const email = (me?.mail || me?.userPrincipalName || "").toLowerCase();
  if (!email.includes("@")) throw new Error("Microsoft account has no email address");
  return email;
}

const recipients = (to: string[]) => to.map((address) => ({ emailAddress: { address } }));

/**
 * Sends a plain-text email as the signed-in user. With `replyToId`, it is a
 * reply in that message's conversation. Done as draft + send so the sent
 * message's id is known (and the next sync recognises it).
 */
export async function outlookSend(accessToken: string, m: { to: string[]; subject: string; body: string; replyToId?: string | null }) {
  try {
    let draft: GraphMessage | null = null;
    if (m.replyToId) {
      draft = await graph<GraphMessage>(`messages/${encodeURIComponent(m.replyToId)}/createReply`, accessToken, { method: "POST", body: {} });
      if (draft) {
        // Our text replaces the quoted original, like a Gmail reply from Flavio.
        await graph(`messages/${encodeURIComponent(draft.id)}`, accessToken, {
          method: "PATCH",
          body: { subject: m.subject, body: { contentType: "Text", content: m.body }, toRecipients: recipients(m.to) },
        });
      }
    }
    // A new message, or the original is gone from the mailbox: send as a new conversation.
    draft ??= await graph<GraphMessage>("messages", accessToken, {
      method: "POST",
      body: { subject: m.subject, body: { contentType: "Text", content: m.body }, toRecipients: recipients(m.to) },
    });
    if (!draft) throw new Error("Microsoft Graph returned no draft");
    await graph(`messages/${encodeURIComponent(draft.id)}/send`, accessToken, { method: "POST" });
    return { id: draft.id, threadId: draft.conversationId ?? null };
  } catch (error) {
    if (error instanceof GraphNotAllowed) throw new MailSendNotAllowed("Outlook refused to send (missing send permission)");
    throw error;
  }
}
