import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { findMentionedProperty } from "@/lib/away/logic";
import { listPropertyOptions } from "@/lib/db/activity";
import { createClient } from "@/lib/supabase/server";
import { buildReplyMime, encodeHeader, findPlaceholders, parseRecipients, toBase64Url } from "./compose";
import { gmail, gmailSend, MailAccessRevoked, MailSendNotAllowed } from "./google";
import { outlookSend } from "./microsoft";
import { withArticle, type MailProvider } from "./provider";
import { accessEndedMessage, mailboxWithToken } from "./sync";

// Sends a reply the user wrote (usually from an AI draft) through their own
// Gmail or Outlook account, in the original conversation, and records it in
// the CRM. Only ever called from an explicit "Küldés" click.

const DAILY_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SendInput = { emailId: string; to: string; subject: string; body: string; followUpDays: number | null };

export type SendResult =
  | { ok: true; sentAt: string; logged: "client" | "property" | null; clientId: string | null }
  | { ok: false; error: string; needsPermission?: boolean };

type Fail = { ok: false; error: string; needsPermission?: boolean };

/** The checks every outgoing email passes before anything is sent. */
function checkMessage(input: { to: string; subject: string; body: string }): { ok: true; to: string[]; subject: string; body: string } | Fail {
  const to = parseRecipients(input.to);
  if (!to) return { ok: false, error: "Adj meg érvényes címzettet." };
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || subject.length > 300) return { ok: false, error: "A tárgy üres vagy túl hosszú." };
  if (!body || body.length > 10_000) return { ok: false, error: "A levél szövege üres vagy túl hosszú." };
  const gaps = findPlaceholders(`${subject}\n${body}`);
  if (gaps.length) return { ok: false, error: `Töltsd ki küldés előtt: ${gaps.join(", ")}` };
  return { ok: true, to, subject, body };
}

type Access = NonNullable<Awaited<ReturnType<typeof mailboxWithToken>>>;

/**
 * Sends through the connected provider. A reply goes into the original's
 * conversation: Gmail by its Message-ID headers, Outlook by replying to the
 * stored message. Without a usable original it goes as a new conversation.
 */
async function deliver(
  access: Access,
  m: { from: string; to: string[]; subject: string; body: string; reply?: { providerMessageId: string; threadId: string | null } },
): Promise<{ id: string; threadId: string | null }> {
  if (access.mailbox.provider === "outlook") {
    return outlookSend(access.token, { to: m.to, subject: m.subject, body: m.body, replyToId: m.reply?.providerMessageId ?? null });
  }
  let thread: { inReplyTo: string | null; references: string | null; threadId: string | null } = { inReplyTo: null, references: null, threadId: null };
  if (m.reply) {
    try {
      const meta = await gmail<{ threadId?: string; payload?: { headers?: { name: string; value: string }[] } }>(
        `messages/${encodeURIComponent(m.reply.providerMessageId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
        access.token,
      );
      const h = (name: string) => meta.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? null;
      thread = { inReplyTo: h("Message-ID"), references: h("References"), threadId: meta.threadId ?? m.reply.threadId };
    } catch (error) {
      // Missing original (e.g. test data): sent as a new conversation. Lost access still stops the send.
      if (error instanceof MailAccessRevoked) throw error;
    }
  }
  const mime = buildReplyMime({ from: m.from, to: m.to, subject: m.subject, body: m.body, inReplyTo: thread.inReplyTo, references: thread.references });
  return gmailSend(access.token, toBase64Url(mime), thread.inReplyTo ? thread.threadId : null);
}

/** The user's message for a failed send, after marking a lost send permission. */
async function sendFailure(access: Access, error: unknown): Promise<Fail> {
  if (error instanceof MailSendNotAllowed) {
    const supabase = await createClient();
    await supabase.from("mailboxes").update({ can_send: false }).eq("id", access.mailbox.id);
    return { ok: false, error: `${withArticle(access.mailbox.provider, "", true)} nem engedélyezte a küldést. Engedélyezd újra.`, needsPermission: true };
  }
  if (error instanceof MailAccessRevoked) return { ok: false, error: accessEndedMessage(access.mailbox.provider) };
  console.error(`${access.mailbox.provider} send failed`, error instanceof Error ? error.message : error);
  return { ok: false, error: "A küldés nem sikerült. A levél nem ment el, próbáld újra." };
}

/** The daily limit, then the user's mailbox with a token and the send permission. */
async function sendingAccess(user: CurrentUser, now: Date) {
  const supabase = await createClient();
  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const { count } = await supabase.from("emails").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("sent_from_crm", true).gte("created_at", dayAgo);
  if ((count ?? 0) >= DAILY_LIMIT) return { ok: false as const, error: "Elérted a napi küldési keretet. Holnap újra küldhetsz." };
  let access;
  try {
    access = await mailboxWithToken(user);
  } catch (error) {
    const provider = (await currentProvider(user)) ?? "gmail";
    if (error instanceof MailAccessRevoked) return { ok: false as const, error: accessEndedMessage(provider) };
    console.error("mail access failed", error instanceof Error ? error.message : error);
    return { ok: false as const, error: `${withArticle(provider, "", true)} most nem érhető el. A levél nem ment el, próbáld újra pár perc múlva.` };
  }
  if (!access) return { ok: false as const, error: "Nincs összekapcsolt postafiók. Kapcsold össze a Levelek oldalon." };
  if (!access.mailbox.can_send) return { ok: false as const, error: `A küldéshez engedélyezd ${withArticle(access.mailbox.provider, "-küldést")}.`, needsPermission: true };
  return { ok: true as const, access };
}

async function currentProvider(user: CurrentUser): Promise<MailProvider | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("mailboxes").select("provider").eq("user_id", user.id).eq("organization_id", user.organization.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.provider as MailProvider | undefined) ?? null;
}

export type NewEmailInput = { to: string; subject: string; body: string; clientId: string; propertyId: string | null; followUpDays: number | null; taskTitle: string };

/**
 * Sends a new email (not a reply), e.g. a listing offer, from the user's own
 * Gmail or Outlook, and records it: the outgoing email, an interaction on the client
 * (and listing), and an optional follow-up task.
 */
export async function sendNewEmail(user: CurrentUser, input: NewEmailInput, now: Date): Promise<{ ok: true; sentAt: string } | Fail> {
  if (!UUID.test(input.clientId) || (input.propertyId && !UUID.test(input.propertyId))) return { ok: false, error: "Ismeretlen ügyfél vagy ingatlan." };
  const msg = checkMessage(input);
  if (!msg.ok) return msg;
  const gate = await sendingAccess(user, now);
  if (!gate.ok) return gate;
  const { access } = gate;
  const supabase = await createClient();

  const from = user.fullName ? `${encodeHeader(user.fullName)} <${access.mailbox.email_address}>` : access.mailbox.email_address;
  let sent;
  try {
    sent = await deliver(access, { from, to: msg.to, subject: msg.subject, body: msg.body });
  } catch (error) {
    return sendFailure(access, error);
  }

  // Sent: record it, but never report failure for bookkeeping hiccups.
  const sentAt = now.toISOString();
  const { error: outError } = await supabase.from("emails").insert({
    organization_id: user.organization.id,
    user_id: user.id,
    mailbox_id: access.mailbox.id,
    provider_message_id: sent.id,
    thread_id: sent.threadId,
    direction: "outgoing",
    from_email: access.mailbox.email_address,
    from_name: user.fullName,
    to_emails: msg.to,
    subject: msg.subject,
    snippet: msg.body.slice(0, 200),
    body_text: msg.body,
    received_at: sentAt,
    client_id: input.clientId,
    status: "processed",
    sent_from_crm: true,
  });
  if (outError) console.error("sent email record failed", outError.code);
  const { error: interactionError } = await supabase.from("interactions").insert({
    organization_id: user.organization.id,
    client_id: input.clientId,
    property_id: input.propertyId,
    interaction_type: "email",
    occurred_at: sentAt,
    summary: `Elküldött e-mail: ${msg.subject}`.slice(0, 1000),
    notes: `Címzett: ${msg.to.join(", ")}\n\n${msg.body}`.slice(0, 20_000),
    follow_up_required: input.followUpDays != null,
    source: "ai_assisted",
  });
  if (interactionError) console.error("sent email interaction failed", interactionError.code);
  if (input.followUpDays != null) {
    const { error } = await supabase.from("tasks").insert({
      organization_id: user.organization.id,
      client_id: input.clientId,
      property_id: input.propertyId,
      title: input.taskTitle.slice(0, 300),
      due_at: new Date(now.getTime() + input.followUpDays * 86_400_000).toISOString(),
      priority: "normal",
    });
    if (error) console.error("follow-up task failed", error.code);
  }
  return { ok: true, sentAt };
}

export async function sendReply(user: CurrentUser, input: SendInput, now: Date): Promise<SendResult> {
  if (!UUID.test(input.emailId)) return { ok: false, error: "Ismeretlen levél." };
  const msg = checkMessage(input);
  if (!msg.ok) return msg;
  const { to, subject, body } = msg;

  const supabase = await createClient();
  const { data: original } = await supabase
    .from("emails")
    .select("id, mailbox_id, provider_message_id, thread_id, subject, snippet, body_text, client_id, replied_at")
    .eq("id", input.emailId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!original) return { ok: false, error: "Ismeretlen levél." };

  const gate = await sendingAccess(user, now);
  if (!gate.ok) return gate;
  const { access } = gate;
  if (access.mailbox.id !== original.mailbox_id) return { ok: false, error: "Ez a levél nem a jelenlegi postafiókodból jött." };

  const from = user.fullName ? `${encodeHeader(user.fullName)} <${access.mailbox.email_address}>` : access.mailbox.email_address;
  let sent;
  try {
    sent = await deliver(access, { from, to, subject, body, reply: { providerMessageId: original.provider_message_id, threadId: original.thread_id } });
  } catch (error) {
    return sendFailure(access, error);
  }

  // From here the email is sent: record it, but never report failure for bookkeeping hiccups.
  const sentAt = now.toISOString();
  const { error: outError } = await supabase.from("emails").insert({
    organization_id: user.organization.id,
    user_id: user.id,
    mailbox_id: access.mailbox.id,
    provider_message_id: sent.id,
    thread_id: sent.threadId,
    direction: "outgoing",
    from_email: access.mailbox.email_address,
    from_name: user.fullName,
    to_emails: to,
    subject,
    snippet: body.slice(0, 200),
    body_text: body,
    received_at: sentAt,
    client_id: original.client_id,
    status: "processed",
    sent_from_crm: true,
  });
  if (outError) console.error("sent email record failed", outError.code);

  // The CRM timeline: on the client, or on the listing the email is about.
  const properties = original.client_id ? [] : await listPropertyOptions(user).catch(() => []);
  const property = original.client_id ? undefined : findMentionedProperty(`${original.subject ?? ""}\n${original.body_text ?? original.snippet ?? ""}`, properties);
  let interactionId: string | null = null;
  if (original.client_id || property) {
    const { data: interaction, error } = await supabase
      .from("interactions")
      .insert({
        organization_id: user.organization.id,
        client_id: original.client_id,
        property_id: property?.id ?? null,
        interaction_type: "email",
        occurred_at: sentAt,
        summary: `Elküldött válasz: ${subject}`.slice(0, 1000),
        notes: `Címzett: ${to.join(", ")}\n\n${body}`.slice(0, 20_000),
        follow_up_required: input.followUpDays != null,
        source: "ai_assisted",
      })
      .select("id")
      .single();
    if (error) console.error("sent email interaction failed", error.code);
    interactionId = interaction?.id ?? null;
  }

  if (input.followUpDays != null && original.client_id) {
    const due = new Date(now.getTime() + input.followUpDays * 86_400_000);
    const { error } = await supabase.from("tasks").insert({
      organization_id: user.organization.id,
      client_id: original.client_id,
      title: "Ha nem válaszolt a levélre, hívd fel",
      due_at: due.toISOString(),
      priority: "normal",
    });
    if (error) console.error("follow-up task failed", error.code);
  }

  // A known client's email is done. A new inquirer stays in Levelek until saved as a client.
  const { error: markError } = await supabase
    .from("emails")
    .update(original.client_id ? { replied_at: sentAt, status: "processed", interaction_id: interactionId } : { replied_at: sentAt })
    .eq("id", original.id)
    .eq("user_id", user.id);
  if (markError) console.error("mark replied failed", markError.code);

  return { ok: true, sentAt, logged: original.client_id ? "client" : property ? "property" : null, clientId: original.client_id };
}
