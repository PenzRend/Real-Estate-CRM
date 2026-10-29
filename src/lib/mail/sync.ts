import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/db";
import { decryptToken, encryptToken } from "./crypto";
import { gmail, MailAccessRevoked, refreshAccessToken, revokeToken } from "./google";
import { ImapUnreachable, openImapReader } from "./imap";
import type { ServerSettings } from "./imap-settings";
import { graphAddress, listOutlookMessages, outlookBody, refreshMicrosoftToken, type GraphMessage } from "./microsoft";
import { decodeEntities, extractBody, header, parseAddress, parseAddressList, stripQuotedReply, type Address, type GmailPart } from "./parse";
import { withArticle, type MailProvider } from "./provider";
import { classifyEmail } from "./relevance";

export type Mailbox = {
  id: string;
  provider: MailProvider;
  email_address: string;
  status: "active" | "revoked" | "error";
  last_error: string | null;
  last_synced_at: string | null;
  /** The provider granted the separate send permission. */
  can_send: boolean;
  /** The provider granted the separate calendar permission. */
  can_calendar: boolean;
  /** The default sender for new emails (offers) when the agent has several mailboxes. */
  is_primary: boolean;
};

type MailboxSecrets = Mailbox & {
  organization_id: string;
  /** OAuth refresh token, or for IMAP the app password. */
  refresh_token_enc: string;
  server_settings: ServerSettings | null;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
};

const FIRST_SYNC_DAYS = 14;
const MAX_MESSAGES_PER_SYNC = 300;
const MAX_IDS_LISTED = 3000; // ids are cheap; listing far back lets a capped sync resume from the oldest
const OVERLAP_SECONDS = 600; // re-check the last 10 minutes so nothing slips between syncs

const PUBLIC_COLUMNS = "id, provider, email_address, status, last_error, last_synced_at, can_send, can_calendar, is_primary";
const SECRET_COLUMNS = `${PUBLIC_COLUMNS}, organization_id, refresh_token_enc, access_token_enc, access_token_expires_at, server_settings`;

/** The agent's mailboxes in this workspace, the default one first. */
export async function listMailboxes(user: CurrentUser): Promise<Mailbox[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("mailboxes")
    .select(PUBLIC_COLUMNS)
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load mailboxes: ${error.message}`);
  return (data ?? []) as Mailbox[];
}

/** The default mailbox (new emails and offers go from it), or null when none is connected. */
export async function getMailbox(user: CurrentUser): Promise<Mailbox | null> {
  return (await listMailboxes(user))[0] ?? null;
}

/**
 * One mailbox with its secrets: by id; "calendar" for the one whose calendar
 * Flavio uses (the default one if it has the permission, else any that has);
 * or the default one.
 */
async function loadSecrets(user: CurrentUser, pick?: string): Promise<MailboxSecrets | null> {
  const supabase = await db();
  let q = supabase.from("mailboxes").select(SECRET_COLUMNS).eq("user_id", user.id).eq("organization_id", user.organization.id);
  if (pick && pick !== "calendar") q = q.eq("id", pick);
  const { data, error } = await q.order("is_primary", { ascending: false }).order("created_at", { ascending: true }).limit(20);
  if (error) throw new Error(`Failed to load mailbox: ${error.message}`);
  const rows = (data ?? []) as MailboxSecrets[];
  if (pick === "calendar") return rows.find((m) => m.can_calendar && m.status !== "revoked") ?? rows.find((m) => m.provider !== "imap") ?? null;
  return rows[0] ?? null;
}

async function markMailbox(
  id: string,
  patch: Partial<Pick<MailboxSecrets, "status" | "last_error" | "last_synced_at" | "access_token_enc" | "access_token_expires_at" | "refresh_token_enc">>,
) {
  const supabase = await db();
  const { error } = await supabase.from("mailboxes").update(patch).eq("id", id);
  if (error) console.error("mailbox update failed", error.code);
}

/** A valid access token: the cached one, or a fresh one from the refresh token. */
async function accessToken(m: MailboxSecrets): Promise<string> {
  if (m.provider === "imap") return decryptToken(m.refresh_token_enc);
  if (m.access_token_enc && m.access_token_expires_at && new Date(m.access_token_expires_at) > new Date()) {
    return decryptToken(m.access_token_enc);
  }
  const refresh = decryptToken(m.refresh_token_enc);
  const fresh = m.provider === "outlook" ? await refreshMicrosoftToken(refresh) : await refreshAccessToken(refresh);
  await markMailbox(m.id, {
    access_token_enc: encryptToken(fresh.access_token),
    access_token_expires_at: new Date(Date.now() + (fresh.expires_in - 60) * 1000).toISOString(),
    // Microsoft hands out a new refresh token with each refresh; the old one soon stops working.
    ...(fresh.refresh_token && fresh.refresh_token !== refresh ? { refresh_token_enc: encryptToken(fresh.refresh_token) } : {}),
  });
  return fresh.access_token;
}

/** "A Gmail-hozzáférés megszűnt…" with the right provider name. */
export const accessEndedMessage = (provider: MailProvider) => `${withArticle(provider, "-hozzáférés", true)} megszűnt. Kapcsold össze újra a Levelek oldalon.`;
const revokedNote = (provider: MailProvider) =>
  provider === "imap"
    ? "A szerver nem fogadja el a jelszót (megváltozott, vagy az alkalmazásjelszót visszavonták)."
    : `A ${provider === "outlook" ? "Microsoft" : "Google"}-hozzáférést visszavonták vagy lejárt.`;

/**
 * A mailbox with a usable access token (for IMAP: the password), for sending
 * or the calendar: by id, "calendar", or the default one. Throws
 * MailAccessRevoked when the provider's access ended.
 */
export async function mailboxWithToken(user: CurrentUser, pick?: string) {
  const mailbox = await loadSecrets(user, pick);
  if (!mailbox || mailbox.status === "revoked") return null;
  try {
    return { mailbox, token: await accessToken(mailbox) };
  } catch (error) {
    if (error instanceof MailAccessRevoked) {
      await markMailbox(mailbox.id, { status: "revoked", last_error: revokedNote(mailbox.provider) });
    }
    throw error;
  }
}

/** A newly stored incoming email worth telling the agent about at once (a portal inquiry or a client writing). */
export type Arrival = { emailId: string; fromName: string | null; fromEmail: string | null; subject: string | null; portal: string | null; fromClient: boolean };

type MailboxSync = { ok: true; checked: number; stored: number; arrivals: Arrival[] } | { ok: false; error: string; revoked?: boolean };

/** All of the agent's mailboxes synced: what was stored, and a message per mailbox that failed. */
export type SyncResult = { stored: number; errors: string[] };

type GmailMessage = { id: string; threadId?: string; internalDate?: string; snippet?: string; payload?: GmailPart };

/** One message's headers, the same shape from either provider. */
export type Meta = { id: string; threadId: string | null; at: number; from: Address | null; to: string[]; subject: string | null; replyTo: Address | null; snippet: string };

/** Where messages come from: ids newest first, headers for a batch, and the plain-text body. */
type Source = {
  list(since: Date): Promise<string[]>;
  meta(ids: string[]): Promise<Meta[]>;
  body(id: string): Promise<string>;
  close?(): Promise<void>;
};

function gmailSource(token: string): Source {
  return {
    async list(since) {
      const ids: string[] = [];
      let pageToken: string | undefined;
      do {
        const q = encodeURIComponent(`after:${Math.floor(since.getTime() / 1000)} -in:chats`);
        const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
          `messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`,
          token,
        );
        ids.push(...(page.messages ?? []).map((m) => m.id));
        pageToken = page.nextPageToken;
      } while (pageToken && ids.length < MAX_IDS_LISTED);
      return ids;
    },
    meta: (ids) => gmailMetas(token, ids),
    body: (id) => gmailBody(token, id),
  };
}

/** Headers of Gmail messages, one request each. */
export async function gmailMetas(token: string, ids: string[]): Promise<Meta[]> {
  const messages = await Promise.all(
    ids.map((id) =>
      gmail<GmailMessage>(
        `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Reply-To`,
        token,
      ),
    ),
  );
  return messages.map((m) => {
    const payload = m.payload ?? {};
    return {
      id: m.id,
      threadId: m.threadId ?? null,
      at: Number(m.internalDate ?? 0),
      from: parseAddress(header(payload, "From")),
      to: [...parseAddressList(header(payload, "To")), ...parseAddressList(header(payload, "Cc"))].map((a) => a.email),
      subject: header(payload, "Subject") ?? null,
      replyTo: parseAddress(header(payload, "Reply-To")),
      snippet: decodeEntities(m.snippet ?? ""),
    };
  });
}

export async function gmailBody(token: string, id: string) {
  const full = await gmail<GmailMessage>(`messages/${encodeURIComponent(id)}?format=full`, token);
  return extractBody(full.payload ?? {});
}

function outlookSource(token: string): Source {
  // Graph lists headers with the ids, so meta() is answered from the listing.
  const listed = new Map<string, GraphMessage>();
  return {
    async list(since) {
      for (const m of await listOutlookMessages(token, since, MAX_IDS_LISTED)) listed.set(m.id, m);
      return [...listed.keys()];
    },
    async meta(ids) {
      return ids.flatMap((id) => {
        const m = listed.get(id);
        if (!m) return [];
        return [
          {
            id,
            threadId: m.conversationId ?? null,
            at: m.receivedDateTime ? Date.parse(m.receivedDateTime) : 0,
            from: graphAddress(m.from),
            to: [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])].flatMap((a) => graphAddress(a)?.email ?? []),
            subject: m.subject ?? null,
            replyTo: graphAddress(m.replyTo?.[0]),
            snippet: m.bodyPreview ?? "",
          },
        ];
      });
    },
    body: (id) => outlookBody(token, id),
  };
}

async function imapSource(settings: ServerSettings, password: string): Promise<Source> {
  const reader = await openImapReader(settings, password);
  const listed = new Map<string, Meta>();
  return {
    async list(since) {
      for (const m of await reader.list(since, MAX_IDS_LISTED)) listed.set(m.id, { ...m, snippet: "" });
      return [...listed.keys()];
    },
    async meta(ids) {
      return ids.flatMap((id) => listed.get(id) ?? []);
    },
    body: (id) => reader.body(id),
    close: () => reader.close(),
  };
}

/**
 * Pulls new mail since the last sync and stores only the relevant messages
 * (see relevance.ts). Safe to run repeatedly: messages are unique per mailbox.
 */
export async function syncMailbox(user: CurrentUser, mailboxId: string): Promise<MailboxSync> {
  const mailbox = await loadSecrets(user, mailboxId);
  if (!mailbox) return { ok: false, error: "Nincs összekapcsolt postafiók." };
  if (mailbox.status === "revoked") return { ok: false, error: accessEndedMessage(mailbox.provider), revoked: true };

  const startedAt = new Date();
  const supabase = await db();
  let source: Source | null = null;
  try {
    const token = await accessToken(mailbox);
    source =
      mailbox.provider === "imap" && mailbox.server_settings
        ? await imapSource(mailbox.server_settings, token)
        : mailbox.provider === "outlook"
          ? outlookSource(token)
          : gmailSource(token);
    const since = mailbox.last_synced_at
      ? new Date(new Date(mailbox.last_synced_at).getTime() - OVERLAP_SECONDS * 1000)
      : new Date(startedAt.getTime() - FIRST_SYNC_DAYS * 86_400_000);

    // 1. Message ids since the last sync, newest first.
    const ids = await source.list(since);

    // 2. Skip what is already stored.
    const { data: known } = await supabase.from("emails").select("provider_message_id").eq("mailbox_id", mailbox.id).in("provider_message_id", ids.length ? ids : ["-"]);
    const knownIds = new Set((known ?? []).map((k) => k.provider_message_id));
    // Over the cap, take the oldest and resume after them next time, so a busy
    // mailbox is caught up over a few syncs instead of skipping mail.
    const unseen = ids.filter((id) => !knownIds.has(id));
    const capped = unseen.length > MAX_MESSAGES_PER_SYNC;
    const fresh = capped ? unseen.slice(-MAX_MESSAGES_PER_SYNC) : unseen;
    let newestChecked = 0;

    // 3. Known client addresses in this workspace.
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, email")
      .eq("organization_id", user.organization.id)
      .is("archived_at", null)
      .not("email", "is", null)
      .limit(10_000);
    const clientByEmail = new Map((clientRows ?? []).map((c) => [String(c.email).toLowerCase(), c.id as string]));
    const clientEmails = new Set(clientByEmail.keys());

    // 4. Headers first; full content only for relevant messages.
    let stored = 0;
    const arrivals: Arrival[] = [];
    for (let i = 0; i < fresh.length; i += 10) {
      for (const meta of await source.meta(fresh.slice(i, i + 10))) {
        newestChecked = Math.max(newestChecked, meta.at);
        const verdict = classifyEmail({ from: meta.from?.email ?? null, to: meta.to, subject: meta.subject }, clientEmails, mailbox.email_address);
        if (!verdict.keep) continue;

        const body = stripQuotedReply(await source.body(meta.id)).slice(0, 20_000);
        const snippet = meta.snippet || body.replace(/\s+/g, " ").slice(0, 200);
        const outgoing = meta.from?.email === mailbox.email_address.toLowerCase();
        const clientId = verdict.clientEmail ? (clientByEmail.get(verdict.clientEmail) ?? null) : null;
        const { data: row, error } = await supabase.from("emails").insert({
          organization_id: user.organization.id,
          user_id: user.id,
          mailbox_id: mailbox.id,
          provider_message_id: meta.id,
          thread_id: meta.threadId,
          direction: outgoing ? "outgoing" : "incoming",
          from_email: meta.from?.email ?? null,
          from_name: meta.from?.name ?? null,
          reply_to_email: meta.replyTo && meta.replyTo.email !== meta.from?.email ? meta.replyTo.email.slice(0, 320) : null,
          to_emails: meta.to.slice(0, 50),
          subject: meta.subject?.slice(0, 1000) ?? null,
          snippet: snippet.slice(0, 1000),
          body_text: body || null,
          received_at: new Date(meta.at || Date.now()).toISOString(),
          portal: verdict.portal,
          client_id: clientId,
        }).select("id").single();
        if (!error) {
          stored++;
          // Only what arrived since the last sync is news (the first sync loads two weeks back).
          if (!outgoing && row && mailbox.last_synced_at) {
            arrivals.push({ emailId: row.id, fromName: meta.from?.name ?? null, fromEmail: meta.from?.email ?? null, subject: meta.subject, portal: verdict.portal, fromClient: Boolean(clientId) });
          }
        }
        else if (error.code !== "23505") console.error("email insert failed", error.code); // 23505: stored by a parallel sync
      }
    }

    const syncedUntil = capped && newestChecked ? new Date(newestChecked) : startedAt;
    await markMailbox(mailbox.id, { last_synced_at: syncedUntil.toISOString(), status: "active", last_error: null });
    return { ok: true, checked: fresh.length, stored, arrivals };
  } catch (error) {
    if (error instanceof MailAccessRevoked) {
      await markMailbox(mailbox.id, { status: "revoked", last_error: revokedNote(mailbox.provider) });
      return { ok: false, error: accessEndedMessage(mailbox.provider), revoked: true };
    }
    console.error("mail sync failed", error instanceof Error ? error.message : error);
    const note = error instanceof ImapUnreachable ? error.message : "A legutóbbi szinkronizálás nem sikerült.";
    await markMailbox(mailbox.id, { status: "error", last_error: note });
    return { ok: false, error: "A levelek lekérése nem sikerült. Próbáld újra később." };
  } finally {
    await source?.close?.().catch(() => undefined);
  }
}

/** Syncs every mailbox that still has access (or those `only` picks), one after another. */
export async function syncMailboxes(user: CurrentUser, only?: (m: Mailbox) => boolean): Promise<SyncResult> {
  const result: SyncResult = { stored: 0, errors: [] };
  for (const m of await listMailboxes(user)) {
    if (m.status === "revoked" || (only && !only(m))) continue;
    const r = await syncMailbox(user, m.id);
    if (r.ok) result.stored += r.stored;
    else result.errors.push(`${m.email_address}: ${r.error}`);
  }
  return result;
}

/**
 * Ends access to one mailbox and deletes it; its unprocessed imported emails go
 * with it. Google tokens are revoked at Google; Microsoft has no per-token
 * revocation and an IMAP password is the agent's own, so deleting our copy is
 * what ends Flavio's access there. Another mailbox becomes the default.
 */
export async function disconnectMailbox(user: CurrentUser, mailboxId: string) {
  const supabase = await db();
  const { data: m } = await supabase
    .from("mailboxes")
    .select("id, provider, refresh_token_enc, is_primary")
    .eq("id", mailboxId)
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (!m) return;
  if (m.provider === "gmail") {
    try {
      await revokeToken(decryptToken(m.refresh_token_enc));
    } catch {
      // Revocation is best effort; deleting our copy still ends access from Flavio.
    }
  }
  const { error } = await supabase.from("mailboxes").delete().eq("id", m.id).eq("user_id", user.id);
  if (error) throw new Error(`Failed to delete mailbox: ${error.code}`);
  if (m.is_primary) {
    const [next] = await listMailboxes(user);
    if (next) await setPrimaryMailbox(user, next.id);
  }
}

/** Makes one of the agent's mailboxes the default sender. */
export async function setPrimaryMailbox(user: CurrentUser, mailboxId: string) {
  const supabase = await db();
  const { error: clearError } = await supabase
    .from("mailboxes")
    .update({ is_primary: false })
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .eq("is_primary", true)
    .neq("id", mailboxId);
  if (clearError) throw new Error(`Failed to update mailboxes: ${clearError.code}`);
  const { error } = await supabase.from("mailboxes").update({ is_primary: true }).eq("id", mailboxId).eq("user_id", user.id).eq("organization_id", user.organization.id);
  if (error) throw new Error(`Failed to update mailbox: ${error.code}`);
}

/** True when the agent has no mailbox yet: a new one then becomes the default. */
export async function isFirstMailbox(user: CurrentUser) {
  const supabase = await db();
  const { count } = await supabase.from("mailboxes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("organization_id", user.organization.id);
  return (count ?? 0) === 0;
}
