import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gmail, MailAccessRevoked } from "./google";
import { browseImap, ImapUnreachable, readImapMessage, type ImapMeta } from "./imap";
import { browseOutlook, graphAddress, outlookBody, outlookMessage, type GraphMessage } from "./microsoft";
import { stripQuotedReply, type Address } from "./parse";
import type { MailProvider } from "./provider";
import { classifyEmail } from "./relevance";
import { accessEndedMessage, gmailBody, gmailMetas, mailboxWithToken, type Meta } from "./sync";

// "Összes levél": the whole mailbox, read live from Gmail, Outlook or the IMAP
// server and never stored. Only an email the agent picks ("Feldolgozás") is
// brought into Flavio, like the relevant ones the sync keeps.

const PAGE = 25;

export type BrowsedMail = {
  /** How to open this message at the provider (Gmail / Outlook id, IMAP UID). */
  ref: string;
  at: number;
  from: Address | null;
  to: string[];
  subject: string | null;
  snippet: string;
  /** Already in Flavio: the stored email's id. */
  storedId: string | null;
};

export type BrowsePage =
  | { ok: true; mailbox: { id: string; email: string; provider: MailProvider }; items: BrowsedMail[]; next: string | null }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One message in the shape the sync stores, plus the id it is stored under. */
type Full = Meta & { key: string };

const fromGraph = (m: GraphMessage): Full => ({
  id: m.id,
  key: m.id,
  threadId: m.conversationId ?? null,
  at: m.receivedDateTime ? Date.parse(m.receivedDateTime) : 0,
  from: graphAddress(m.from),
  to: [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])].flatMap((a) => graphAddress(a)?.email ?? []),
  subject: m.subject ?? null,
  replyTo: graphAddress(m.replyTo?.[0]),
  snippet: m.bodyPreview ?? "",
});

const fromImap = (m: ImapMeta): Full => ({ ...m, id: String(m.uid), key: m.id, snippet: "" });

function failure(error: unknown, provider: MailProvider): { ok: false; error: string } {
  if (error instanceof MailAccessRevoked) return { ok: false, error: accessEndedMessage(provider) };
  if (error instanceof ImapUnreachable) return { ok: false, error: error.message };
  console.error("mail browse failed", error instanceof Error ? error.message : error);
  return { ok: false, error: "A levelek most nem érhetők el. Próbáld újra." };
}

async function access(user: CurrentUser, mailboxId: string) {
  if (!UUID.test(mailboxId)) return null;
  const a = await mailboxWithToken(user, mailboxId);
  return a && a.mailbox.id === mailboxId ? a : null;
}

/** One page of the mailbox, newest first; `query` searches sender, subject and text. */
export async function browseMailbox(user: CurrentUser, mailboxId: string, p: { cursor?: string | null; query?: string | null }): Promise<BrowsePage> {
  let a;
  try {
    a = await access(user, mailboxId);
  } catch (error) {
    return failure(error, "gmail");
  }
  if (!a) return { ok: false, error: "Ismeretlen postafiók." };
  const { mailbox, token } = a;
  const query = p.query?.trim().slice(0, 200) || null;
  try {
    let full: Full[];
    let next: string | null;
    if (mailbox.provider === "outlook") {
      const page = await browseOutlook(token, { cursor: p.cursor, query, top: PAGE });
      full = page.items.map(fromGraph);
      next = page.next;
    } else if (mailbox.provider === "imap") {
      if (!mailbox.server_settings) return { ok: false, error: "A postafiók beállításai hiányoznak. Kapcsold össze újra." };
      const before = p.cursor && /^\d+$/.test(p.cursor) ? Number(p.cursor) : null;
      const page = await browseImap(mailbox.server_settings, token, { before, query, top: PAGE });
      full = page.items.map(fromImap);
      next = page.next ? String(page.next) : null;
    } else {
      const pageToken = p.cursor && /^[\w-]+$/.test(p.cursor) ? p.cursor : null;
      const q = encodeURIComponent(query ? `${query} -in:chats` : "-in:chats -in:drafts");
      const list = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(`messages?q=${q}&maxResults=${PAGE}${pageToken ? `&pageToken=${pageToken}` : ""}`, token);
      full = (await gmailMetas(token, (list.messages ?? []).map((m) => m.id))).map((m) => ({ ...m, key: m.id }));
      next = list.nextPageToken ?? null;
    }

    // Which of these are already in Flavio.
    const supabase = await createClient();
    const keys = full.map((m) => m.key);
    const { data: stored } = await supabase.from("emails").select("id, provider_message_id").eq("mailbox_id", mailbox.id).in("provider_message_id", keys.length ? keys : ["-"]);
    const storedBy = new Map((stored ?? []).map((s) => [s.provider_message_id as string, s.id as string]));

    return {
      ok: true,
      mailbox: { id: mailbox.id, email: mailbox.email_address, provider: mailbox.provider },
      items: full.map((m) => ({ ref: m.id, at: m.at, from: m.from, to: m.to, subject: m.subject, snippet: m.snippet, storedId: storedBy.get(m.key) ?? null })),
      next,
    };
  } catch (error) {
    return failure(error, mailbox.provider);
  }
}

/** Headers and plain-text body of one message, read live. */
async function fetchOne(provider: MailProvider, token: string, settings: Parameters<typeof readImapMessage>[0] | null, ref: string): Promise<{ meta: Full; body: string } | null> {
  if (provider === "imap") {
    if (!settings || !/^\d+$/.test(ref)) return null;
    const m = await readImapMessage(settings, token, Number(ref));
    return m ? { meta: fromImap(m.meta), body: m.body } : null;
  }
  if (provider === "outlook") {
    const [m, body] = await Promise.all([outlookMessage(token, ref), outlookBody(token, ref)]);
    return m ? { meta: fromGraph(m), body } : null;
  }
  if (!/^[\w-]+$/.test(ref)) return null;
  const [[m], body] = await Promise.all([gmailMetas(token, [ref]), gmailBody(token, ref)]);
  return m ? { meta: { ...m, key: m.id }, body } : null;
}

/** The text of one email, for reading it in the list. */
export async function readMail(user: CurrentUser, mailboxId: string, ref: string): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  let a;
  try {
    a = await access(user, mailboxId);
    if (!a) return { ok: false, error: "Ismeretlen postafiók." };
    const m = await fetchOne(a.mailbox.provider, a.token, a.mailbox.server_settings, ref);
    if (!m) return { ok: false, error: "Ez a levél már nincs meg a postafiókban." };
    return { ok: true, body: m.body.slice(0, 50_000) || "(A levélnek nincs szöveges része.)" };
  } catch (error) {
    return failure(error, a?.mailbox.provider ?? "gmail");
  }
}

/**
 * Brings one email into Flavio (the agent asked for it, so the relevance
 * filter is skipped) and returns its id for processing. An email already
 * there is returned as it is.
 */
export async function importMail(user: CurrentUser, mailboxId: string, ref: string): Promise<{ ok: true; emailId: string } | { ok: false; error: string }> {
  let a;
  try {
    a = await access(user, mailboxId);
    if (!a) return { ok: false, error: "Ismeretlen postafiók." };
    const { mailbox, token } = a;
    const got = await fetchOne(mailbox.provider, token, mailbox.server_settings, ref);
    if (!got) return { ok: false, error: "Ez a levél már nincs meg a postafiókban." };
    const { meta } = got;
    const supabase = await createClient();

    const { data: existing } = await supabase.from("emails").select("id").eq("mailbox_id", mailbox.id).eq("provider_message_id", meta.key).maybeSingle();
    if (existing) return { ok: true, emailId: existing.id };

    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, email")
      .eq("organization_id", user.organization.id)
      .is("archived_at", null)
      .in("email", [...new Set([meta.from?.email, meta.replyTo?.email, ...meta.to].filter((e): e is string => Boolean(e)))]);
    const clientByEmail = new Map((clientRows ?? []).map((c) => [String(c.email).toLowerCase(), c.id as string]));
    const verdict = classifyEmail({ from: meta.from?.email ?? null, to: meta.to, subject: meta.subject }, new Set(clientByEmail.keys()), mailbox.email_address);
    const body = stripQuotedReply(got.body).slice(0, 20_000);
    const outgoing = meta.from?.email === mailbox.email_address.toLowerCase();

    const { data: inserted, error } = await supabase
      .from("emails")
      .insert({
        organization_id: user.organization.id,
        user_id: user.id,
        mailbox_id: mailbox.id,
        provider_message_id: meta.key,
        thread_id: meta.threadId,
        direction: outgoing ? "outgoing" : "incoming",
        from_email: meta.from?.email ?? null,
        from_name: meta.from?.name ?? null,
        reply_to_email: meta.replyTo && meta.replyTo.email !== meta.from?.email ? meta.replyTo.email.slice(0, 320) : null,
        to_emails: meta.to.slice(0, 50),
        subject: meta.subject?.slice(0, 1000) ?? null,
        snippet: (meta.snippet || body.replace(/\s+/g, " ").slice(0, 200)).slice(0, 1000),
        body_text: body || null,
        received_at: new Date(meta.at || Date.now()).toISOString(),
        // Not relevant by the sync's rules is fine here; the agent picked it.
        portal: verdict.keep ? verdict.portal : null,
        client_id: verdict.keep && verdict.clientEmail ? (clientByEmail.get(verdict.clientEmail) ?? null) : null,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("email import failed", error?.code);
      return { ok: false, error: "A levelet nem sikerült átvenni. Próbáld újra." };
    }
    return { ok: true, emailId: inserted.id };
  } catch (error) {
    return failure(error, a?.mailbox.provider ?? "gmail");
  }
}
