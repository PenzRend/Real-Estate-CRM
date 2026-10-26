import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "./crypto";
import { gmail, MailAccessRevoked, refreshAccessToken, revokeToken } from "./google";
import { extractBody, header, parseAddress, parseAddressList, stripQuotedReply, type GmailPart } from "./parse";
import { classifyEmail } from "./relevance";

export type Mailbox = {
  id: string;
  email_address: string;
  status: "active" | "revoked" | "error";
  last_error: string | null;
  last_synced_at: string | null;
  /** Google granted the separate send permission. */
  can_send: boolean;
};

type MailboxSecrets = Mailbox & {
  organization_id: string;
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
};

const FIRST_SYNC_DAYS = 14;
const MAX_MESSAGES_PER_SYNC = 300;
const OVERLAP_SECONDS = 600; // re-check the last 10 minutes so nothing slips between syncs

export async function getMailbox(user: CurrentUser): Promise<Mailbox | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailboxes")
    .select("id, email_address, status, last_error, last_synced_at, can_send")
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load mailbox: ${error.message}`);
  return data as Mailbox | null;
}

async function loadSecrets(user: CurrentUser): Promise<MailboxSecrets | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailboxes")
    .select("id, organization_id, email_address, status, last_error, last_synced_at, can_send, refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load mailbox: ${error.message}`);
  return data as MailboxSecrets | null;
}

async function markMailbox(id: string, patch: Partial<Pick<MailboxSecrets, "status" | "last_error" | "last_synced_at" | "access_token_enc" | "access_token_expires_at">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("mailboxes").update(patch).eq("id", id);
  if (error) console.error("mailbox update failed", error.code);
}

/** A valid access token: the cached one, or a fresh one from the refresh token. */
async function accessToken(m: MailboxSecrets): Promise<string> {
  if (m.access_token_enc && m.access_token_expires_at && new Date(m.access_token_expires_at) > new Date()) {
    return decryptToken(m.access_token_enc);
  }
  const fresh = await refreshAccessToken(decryptToken(m.refresh_token_enc));
  await markMailbox(m.id, {
    access_token_enc: encryptToken(fresh.access_token),
    access_token_expires_at: new Date(Date.now() + (fresh.expires_in - 60) * 1000).toISOString(),
  });
  return fresh.access_token;
}

/** The user's mailbox with a usable access token, for sending. Throws MailAccessRevoked when Google access ended. */
export async function mailboxWithToken(user: CurrentUser) {
  const mailbox = await loadSecrets(user);
  if (!mailbox || mailbox.status === "revoked") return null;
  try {
    return { mailbox, token: await accessToken(mailbox) };
  } catch (error) {
    if (error instanceof MailAccessRevoked) {
      await markMailbox(mailbox.id, { status: "revoked", last_error: "A Google-hozzáférést visszavonták vagy lejárt." });
    }
    throw error;
  }
}

export type SyncResult =
  | { ok: true; checked: number; stored: number }
  | { ok: false; error: string; revoked?: boolean };

type GmailMessage = { id: string; threadId?: string; internalDate?: string; snippet?: string; payload?: GmailPart };

/**
 * Pulls new mail since the last sync and stores only the relevant messages
 * (see relevance.ts). Safe to run repeatedly: messages are unique per mailbox.
 */
export async function syncMailbox(user: CurrentUser): Promise<SyncResult> {
  const mailbox = await loadSecrets(user);
  if (!mailbox) return { ok: false, error: "Nincs összekapcsolt postafiók." };
  if (mailbox.status === "revoked") return { ok: false, error: "A Gmail-hozzáférés megszűnt. Kapcsold össze újra.", revoked: true };

  const startedAt = new Date();
  const supabase = await createClient();
  try {
    const token = await accessToken(mailbox);
    const since = mailbox.last_synced_at
      ? Math.floor(new Date(mailbox.last_synced_at).getTime() / 1000) - OVERLAP_SECONDS
      : Math.floor(startedAt.getTime() / 1000) - FIRST_SYNC_DAYS * 86_400;

    // 1. Message ids since the last sync.
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const q = encodeURIComponent(`after:${since} -in:chats`);
      const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
        `messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`,
        token,
      );
      ids.push(...(page.messages ?? []).map((m) => m.id));
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < MAX_MESSAGES_PER_SYNC);

    // 2. Skip what is already stored.
    const { data: known } = await supabase.from("emails").select("provider_message_id").eq("mailbox_id", mailbox.id).in("provider_message_id", ids.length ? ids : ["-"]);
    const knownIds = new Set((known ?? []).map((k) => k.provider_message_id));
    const fresh = ids.filter((id) => !knownIds.has(id)).slice(0, MAX_MESSAGES_PER_SYNC);

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
    for (let i = 0; i < fresh.length; i += 10) {
      const batch = fresh.slice(i, i + 10);
      const metas = await Promise.all(
        batch.map((id) =>
          gmail<GmailMessage>(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Reply-To`, token),
        ),
      );
      for (const meta of metas) {
        const payload = meta.payload ?? {};
        const from = parseAddress(header(payload, "From"));
        const to = [...parseAddressList(header(payload, "To")), ...parseAddressList(header(payload, "Cc"))].map((a) => a.email);
        const subject = header(payload, "Subject") ?? null;
        const replyTo = parseAddress(header(payload, "Reply-To"));
        const verdict = classifyEmail({ from: from?.email ?? null, to, subject }, clientEmails, mailbox.email_address);
        if (!verdict.keep) continue;

        const full = await gmail<GmailMessage>(`messages/${meta.id}?format=full`, token);
        const body = stripQuotedReply(extractBody(full.payload ?? {})).slice(0, 20_000);
        const outgoing = from?.email === mailbox.email_address.toLowerCase();
        const { error } = await supabase.from("emails").insert({
          organization_id: user.organization.id,
          user_id: user.id,
          mailbox_id: mailbox.id,
          provider_message_id: meta.id,
          thread_id: meta.threadId ?? null,
          direction: outgoing ? "outgoing" : "incoming",
          from_email: from?.email ?? null,
          from_name: from?.name ?? null,
          reply_to_email: replyTo && replyTo.email !== from?.email ? replyTo.email.slice(0, 320) : null,
          to_emails: to.slice(0, 50),
          subject: subject?.slice(0, 1000) ?? null,
          snippet: (full.snippet ?? meta.snippet ?? "").slice(0, 1000),
          body_text: body || null,
          received_at: new Date(Number(full.internalDate ?? meta.internalDate ?? Date.now())).toISOString(),
          portal: verdict.portal,
          client_id: verdict.clientEmail ? (clientByEmail.get(verdict.clientEmail) ?? null) : null,
        });
        if (!error) stored++;
        else if (error.code !== "23505") console.error("email insert failed", error.code); // 23505: stored by a parallel sync
      }
    }

    await markMailbox(mailbox.id, { last_synced_at: startedAt.toISOString(), status: "active", last_error: null });
    return { ok: true, checked: fresh.length, stored };
  } catch (error) {
    if (error instanceof MailAccessRevoked) {
      await markMailbox(mailbox.id, { status: "revoked", last_error: "A Google-hozzáférést visszavonták vagy lejárt." });
      return { ok: false, error: "A Gmail-hozzáférés megszűnt. Kapcsold össze újra.", revoked: true };
    }
    console.error("mail sync failed", error instanceof Error ? error.message : error);
    await markMailbox(mailbox.id, { status: "error", last_error: "A legutóbbi szinkronizálás nem sikerült." });
    return { ok: false, error: "A levelek lekérése nem sikerült. Próbáld újra később." };
  }
}

/** Revokes Google access and deletes the mailbox; unprocessed imported emails go with it. */
export async function disconnectMailbox(user: CurrentUser) {
  const mailbox = await loadSecrets(user);
  if (!mailbox) return;
  try {
    await revokeToken(decryptToken(mailbox.refresh_token_enc));
  } catch {
    // Revocation is best effort; deleting our copy still ends access from the CRM.
  }
  const supabase = await createClient();
  const { error } = await supabase.from("mailboxes").delete().eq("id", mailbox.id);
  if (error) throw new Error(`Failed to delete mailbox: ${error.code}`);
}
