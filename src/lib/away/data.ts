import "server-only";
import type { MailProvider } from "@/lib/mail/provider";
import { draftReply } from "@/lib/ai/reply-draft";
import type { CurrentUser } from "@/lib/auth";
import { listPropertyOptions } from "@/lib/db/activity";
import { PORTALS } from "@/lib/mail/relevance";
import { getMailbox } from "@/lib/mail/sync";
import { createClient } from "@/lib/supabase/server";
import type { Ref } from "@/lib/types/view-models";
import { cleanProposedTimes } from "@/lib/viewings/logic";
import { awayHeadline, awaySince, findMentionedProperty, nextVisit, replyRecipient, replySubject, type Visit } from "./logic";

// "Mi történt, amíg távol voltál": unprocessed emails that arrived since the
// last visit, with AI summaries and reply drafts once generated. Emails and
// drafts are private to the user who connected the mailbox (RLS).

export type AwayDraft = {
  summary: string | null;
  nextStep: string | null;
  to: string | null;
  subject: string | null;
  body: string | null;
  /** The sender asked for a viewing; times they proposed (Budapest wall clock). */
  viewing: { requested: boolean; times: string[] } | null;
};

export type AwayItem = {
  id: string;
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: string;
  portal: string | null;
  client: Ref | null;
  /** Null until a draft was generated; body null means no reply is needed. */
  draft: AwayDraft | null;
  /** Replied from the CRM (a new inquirer stays listed until saved as a client). */
  repliedAt: string | null;
  /** Arrived during the away window; otherwise it was already waiting before. */
  isNew: boolean;
};

export type AwaySummary = {
  since: string;
  firstVisit: boolean;
  mailbox: { email: string; provider: MailProvider; lastSyncedAt: string | null; status: string; canSend: boolean } | null;
  headline: string | null;
  items: AwayItem[];
  /** Waiting emails beyond the ones shown, in Levelek. */
  olderNewCount: number;
  tasksDue: number;
};

const DRAFT_COLUMNS = "ai_summary, ai_next_step, draft_to, draft_subject, draft_body, drafted_at, replied_at, ai_viewing";
const ITEM_LIMIT = 6;

type Row = {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  portal: string | null;
  client_id: string | null;
  ai_summary: string | null;
  ai_next_step: string | null;
  draft_to: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  drafted_at: string | null;
  replied_at: string | null;
  ai_viewing: { requested?: boolean; times?: string[] } | null;
};

const toDraft = (r: Row): AwayDraft | null =>
  r.drafted_at
    ? { summary: r.ai_summary, nextStep: r.ai_next_step, to: r.draft_to, subject: r.draft_subject, body: r.draft_body, viewing: toViewing(r.ai_viewing) }
    : null;

function toViewing(v: Row["ai_viewing"]): AwayDraft["viewing"] {
  if (!v?.requested) return null;
  return { requested: true, times: cleanProposedTimes(v.times, new Date()) };
}

async function getVisit(user: CurrentUser): Promise<Visit | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_visits")
    .select("last_seen_at, previous_seen_at")
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  return data ? { lastSeenAt: data.last_seen_at, previousSeenAt: data.previous_seen_at } : null;
}

export async function getAwaySummary(user: CurrentUser, now: Date): Promise<AwaySummary> {
  const supabase = await createClient();
  const visit = await getVisit(user);
  const since = awaySince(visit, now).toISOString();
  const [mailbox, emails, tasks] = await Promise.all([
    getMailbox(user),
    supabase
      .from("emails")
      .select(`id, from_name, from_email, subject, snippet, received_at, portal, client_id, ${DRAFT_COLUMNS}`)
      .eq("user_id", user.id)
      // Everything still waiting, plus what was answered from here during this
      // window (so the "sent" confirmation stays visible).
      .or(`status.eq.new,replied_at.gte.${since}`)
      .neq("status", "ignored")
      .eq("direction", "incoming")
      .order("received_at", { ascending: false })
      .limit(50),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.organization.id)
      .in("status", ["todo", "in_progress"])
      .gte("due_at", since)
      .lte("due_at", now.toISOString()),
  ]);
  if (emails.error) throw new Error(`Failed to load away summary: ${emails.error.message}`);

  const rows = (emails.data ?? []) as Row[];
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
  const { data: clients } = clientIds.length
    ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((clients ?? []).map((c) => [c.id, c.full_name]));

  // New arrivals first, then what is still waiting; within each, portal
  // inquiries and client emails first, newest first.
  const fresh = (r: Row) => r.received_at >= since;
  const rank = (r: Row) => (fresh(r) ? 0 : 3) + (r.portal ? 0 : r.client_id ? 1 : 2);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || b.received_at.localeCompare(a.received_at));
  const arrived = rows.filter(fresh);

  return {
    since,
    firstVisit: !visit,
    mailbox: mailbox
      ? { email: mailbox.email_address, provider: mailbox.provider, lastSyncedAt: mailbox.last_synced_at, status: mailbox.status, canSend: mailbox.can_send }
      : null,
    headline: awayHeadline({
      inquiries: arrived.filter((r) => r.portal).length,
      clientEmails: arrived.filter((r) => !r.portal && r.client_id).length,
      otherEmails: arrived.filter((r) => !r.portal && !r.client_id).length,
      tasksDue: tasks.count ?? 0,
    }),
    items: sorted.slice(0, ITEM_LIMIT).map((r) => ({
      id: r.id,
      fromName: r.from_name,
      fromEmail: r.from_email,
      subject: r.subject,
      snippet: r.snippet,
      receivedAt: r.received_at,
      portal: r.portal,
      client: r.client_id && names.has(r.client_id) ? { id: r.client_id, name: names.get(r.client_id)! } : null,
      draft: toDraft(r),
      repliedAt: r.replied_at,
      isNew: fresh(r),
    })),
    // Only what still waits for an answer; answered ones are listed just for the "sent" note.
    olderNewCount: sorted.slice(ITEM_LIMIT).filter((r) => !r.replied_at).length,
    tasksDue: tasks.count ?? 0,
  };
}

/** Records this dashboard visit; the window rule lives in nextVisit/awaySince. */
export async function markVisit(user: CurrentUser, now: Date) {
  const supabase = await createClient();
  const next = nextVisit(await getVisit(user), now);
  const { error } = await supabase
    .from("user_visits")
    .upsert({ user_id: user.id, organization_id: user.organization.id, last_seen_at: next.lastSeenAt, previous_seen_at: next.previousSeenAt });
  if (error) console.error("markVisit failed", error.code);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DraftOutcome = { ok: true; draft: AwayDraft; model: string; inputTokens: number | null; outputTokens: number | null } | { ok: false; error: string };

/** Writes (or rewrites) the AI summary and reply draft for one of the user's emails. */
export async function generateDraft(user: CurrentUser, emailId: string, now: Date): Promise<DraftOutcome> {
  if (!UUID.test(emailId)) return { ok: false, error: "Ismeretlen levél." };
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("emails")
    .select("id, from_name, from_email, reply_to_email, subject, snippet, body_text, received_at, portal, client_id")
    .eq("id", emailId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!e) return { ok: false, error: "Ismeretlen levél." };

  const body = e.body_text || e.snippet || "";
  const [mailbox, properties, client] = await Promise.all([
    getMailbox(user),
    listPropertyOptions(user),
    e.client_id ? supabase.from("clients").select("email").eq("id", e.client_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const property = findMentionedProperty(`${e.subject ?? ""}\n${body}`, properties);

  const result = await draftReply(
    user,
    {
      email: { fromName: e.from_name, fromEmail: e.from_email, subject: e.subject, portal: e.portal, receivedAt: e.received_at, body },
      clientId: e.client_id,
      propertyId: property?.id ?? null,
    },
    now,
  );
  const d = result.draft;
  const draft: AwayDraft = {
    summary: d.summary,
    nextStep: d.next_step,
    to: d.needs_reply
      ? replyRecipient({
          replyTo: e.reply_to_email,
          fromEmail: e.from_email,
          portal: e.portal,
          clientEmail: (client.data as { email: string | null } | null)?.email ?? null,
          body,
          mailboxEmail: mailbox?.email_address ?? null,
          portalDomains: PORTALS.map((p) => p.domain),
        })
      : null,
    subject: d.needs_reply ? (d.subject ?? replySubject(e.subject)) : null,
    body: d.body,
    viewing: toViewing(d.viewing ?? null),
  };
  const { error } = await supabase
    .from("emails")
    .update({
      ai_summary: draft.summary,
      ai_next_step: draft.nextStep,
      draft_to: draft.to,
      draft_subject: draft.subject,
      draft_body: draft.body,
      ai_viewing: d.viewing ?? null,
      drafted_at: now.toISOString(),
    })
    .eq("id", e.id)
    .eq("user_id", user.id);
  if (error) console.error("draft save failed", error.code);
  return { ok: true, draft, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}
