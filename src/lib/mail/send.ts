import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { findMentionedProperty } from "@/lib/away/logic";
import { listPropertyOptions } from "@/lib/db/activity";
import { createClient } from "@/lib/supabase/server";
import { buildReplyMime, encodeHeader, findPlaceholders, parseRecipients, toBase64Url } from "./compose";
import { gmail, gmailSend, MailAccessRevoked, MailSendNotAllowed } from "./google";
import { mailboxWithToken } from "./sync";

// Sends a reply the user wrote (usually from an AI draft) through their own
// Gmail account, in the original thread, and records it in the CRM. Only ever
// called from an explicit "Küldés" click.

const DAILY_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SendInput = { emailId: string; to: string; subject: string; body: string; followUpDays: number | null };

export type SendResult =
  | { ok: true; sentAt: string; logged: "client" | "property" | null; clientId: string | null }
  | { ok: false; error: string; needsPermission?: boolean };

export async function sendReply(user: CurrentUser, input: SendInput, now: Date): Promise<SendResult> {
  if (!UUID.test(input.emailId)) return { ok: false, error: "Ismeretlen levél." };
  const to = parseRecipients(input.to);
  if (!to) return { ok: false, error: "Adj meg érvényes címzettet." };
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || subject.length > 300) return { ok: false, error: "A tárgy üres vagy túl hosszú." };
  if (!body || body.length > 10_000) return { ok: false, error: "A levél szövege üres vagy túl hosszú." };
  const gaps = findPlaceholders(`${subject}\n${body}`);
  if (gaps.length) return { ok: false, error: `Töltsd ki küldés előtt: ${gaps.join(", ")}` };

  const supabase = await createClient();
  const { data: original } = await supabase
    .from("emails")
    .select("id, mailbox_id, provider_message_id, thread_id, subject, snippet, body_text, client_id, replied_at")
    .eq("id", input.emailId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!original) return { ok: false, error: "Ismeretlen levél." };

  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const { count } = await supabase.from("emails").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("sent_from_crm", true).gte("created_at", dayAgo);
  if ((count ?? 0) >= DAILY_LIMIT) return { ok: false, error: "Elérted a napi küldési keretet. Holnap újra küldhetsz." };

  let access;
  try {
    access = await mailboxWithToken(user);
  } catch (error) {
    if (error instanceof MailAccessRevoked) return { ok: false, error: "A Gmail-hozzáférés megszűnt. Kapcsold össze újra a Levelek oldalon." };
    throw error;
  }
  if (!access || access.mailbox.id !== original.mailbox_id) return { ok: false, error: "Ez a levél nem a jelenlegi postafiókodból jött." };
  if (!access.mailbox.can_send) return { ok: false, error: "A küldéshez engedélyezd a Gmail-küldést.", needsPermission: true };

  // Threading: the original's Message-ID. Missing (e.g. test data) → sent as a new conversation.
  let thread: { inReplyTo: string | null; references: string | null; threadId: string | null } = { inReplyTo: null, references: null, threadId: null };
  try {
    const meta = await gmail<{ threadId?: string; payload?: { headers?: { name: string; value: string }[] } }>(
      `messages/${encodeURIComponent(original.provider_message_id)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
      access.token,
    );
    const h = (name: string) => meta.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? null;
    thread = { inReplyTo: h("Message-ID"), references: h("References"), threadId: meta.threadId ?? original.thread_id };
  } catch (error) {
    if (error instanceof MailAccessRevoked) return { ok: false, error: "A Gmail-hozzáférés megszűnt. Kapcsold össze újra a Levelek oldalon." };
  }

  const from = user.fullName ? `${encodeHeader(user.fullName)} <${access.mailbox.email_address}>` : access.mailbox.email_address;
  const mime = buildReplyMime({ from, to, subject, body, inReplyTo: thread.inReplyTo, references: thread.references });
  let sent;
  try {
    sent = await gmailSend(access.token, toBase64Url(mime), thread.inReplyTo ? thread.threadId : null);
  } catch (error) {
    if (error instanceof MailSendNotAllowed) {
      await supabase.from("mailboxes").update({ can_send: false }).eq("id", access.mailbox.id);
      return { ok: false, error: "A Gmail nem engedélyezte a küldést. Engedélyezd újra.", needsPermission: true };
    }
    if (error instanceof MailAccessRevoked) return { ok: false, error: "A Gmail-hozzáférés megszűnt. Kapcsold össze újra a Levelek oldalon." };
    console.error("gmail send failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "A küldés nem sikerült. A levél nem ment el, próbáld újra." };
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
  const properties = original.client_id ? [] : await listPropertyOptions(user);
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
