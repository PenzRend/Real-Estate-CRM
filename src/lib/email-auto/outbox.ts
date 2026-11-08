import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { sendNewEmail } from "@/lib/mail/send";
import { templateValues } from "@/lib/office-docs/fields";
import { loadRecords } from "@/lib/office-docs/fill";
import { writeAiParagraphs } from "@/lib/office-docs/templates";
import { aiInstructions, fillTemplateText } from "@/lib/office-docs/template-render";
import { db } from "@/lib/supabase/db";
import { appOrigin } from "@/lib/origin";
import { ensureShare } from "@/lib/shares/data";
import { listEmailTemplates, type EmailTemplate, type EmailTrigger } from "./templates";

// The outbox: an event puts one message per matching rule in it, written for
// that client (fields filled, AI paragraphs written now so the agent sees the
// final text). It waits for approval (mode "approve") or its time (delay),
// then goes from the agent's own mailbox – sent by the mail job every few
// minutes, or at once with "Küldés most".

export type OutboxItem = {
  id: string;
  templateName: string | null;
  client: { id: string; name: string };
  toEmail: string;
  subject: string;
  body: string;
  status: "awaiting_approval" | "queued" | "sent" | "failed" | "cancelled";
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Email text: fields filled, Markdown marks taken off (emails go as plain text). */
function plain(s: string) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,2}\s+/gm, "")
    .replace(/^-\s+/gm, "• ")
    // A signature like "{ugynok_nev}\n{iroda}" for a one-person office: the name once.
    .split("\n")
    .filter((line, i, all) => !line.trim() || line.trim() !== all[i - 1]?.trim())
    .join("\n")
    .trim();
}

export type EventRefs = {
  clientId: string;
  propertyId?: string | null;
  dealId?: string | null;
  viewingAt?: string | null;
  feedback?: string | null;
  /** More fields for this event, e.g. the old price of a price drop. */
  extra?: Record<string, string>;
};

/** {ingatlan_link}: the listing's client page (its share link, made the first time a rule needs it). */
async function listingLink(user: CurrentUser, propertyId: string) {
  try {
    const share = await ensureShare(user, propertyId);
    return `${await appOrigin()}/l/${share.token}`;
  } catch {
    return "";
  }
}

/** Writes one rule's message for a client. */
async function render(user: CurrentUser, t: EmailTemplate, refs: EventRefs) {
  const records = await loadRecords(user, { clientId: refs.dealId ? null : refs.clientId, propertyId: refs.dealId ? null : (refs.propertyId ?? null), dealId: refs.dealId ?? null });
  const values: Record<string, string> = {
    ...templateValues(records),
    keresztnev: (records.buyer?.full_name ?? "").trim().split(/\s+/).slice(-1)[0] ?? "",
    megtekintes_ideje: refs.viewingAt
      ? new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(new Date(refs.viewingAt))
      : "",
    visszajelzes: refs.feedback ?? "",
    ...refs.extra,
  };
  if (refs.propertyId && `${t.subject}\n${t.body}`.includes("{ingatlan_link}")) values.ingatlan_link = await listingLink(user, refs.propertyId);
  const instructions = aiInstructions(t.body);
  const ai = instructions.length ? await writeAiParagraphs(user, instructions, values).catch(() => null) : null;
  return {
    subject: plain(fillTemplateText(t.subject, values))
      .replace(/([^,–]+), \1(?=$|[,–])/g, "$1")
      .slice(0, 300),
    body: plain(fillTemplateText(t.body, values, ai ?? instructions.map(() => ""))).slice(0, 20_000),
  };
}

/** An event happened: queue the active rules' messages (each once per event). Returns how many were queued. */
export async function enqueueForEvent(user: CurrentUser, trigger: EmailTrigger, refs: EventRefs, eventKey: string): Promise<number> {
  const templates = (await listEmailTemplates(user)).filter((t) => t.active && t.trigger === trigger);
  if (!templates.length || !UUID.test(refs.clientId)) return 0;
  const supabase = await db();
  const { data: client } = await supabase.from("clients").select("email").eq("id", refs.clientId).eq("organization_id", user.organization.id).maybeSingle();
  if (!client?.email) return 0; // no address: nothing to send
  let queued = 0;
  for (const t of templates) {
    const msg = await render(user, t, refs);
    const { error } = await supabase.from("email_outbox").insert({
      organization_id: user.organization.id,
      template_id: t.id,
      user_id: user.id,
      client_id: refs.clientId,
      property_id: refs.propertyId ?? null,
      deal_id: refs.dealId ?? null,
      event_key: eventKey.slice(0, 200),
      to_email: client.email,
      subject: msg.subject,
      body: msg.body,
      status: t.mode === "auto" ? "queued" : "awaiting_approval",
      scheduled_at: new Date(Date.now() + t.delayMinutes * 60_000).toISOString(),
    });
    // 23505: this rule already wrote for this event.
    if (!error) queued++;
    else if (error.code !== "23505") console.error("outbox insert failed", error.code);
  }
  return queued;
}

export async function listOutbox(user: CurrentUser): Promise<OutboxItem[]> {
  const supabase = await db();
  const { data } = await supabase
    .from("email_outbox")
    .select("id, template_id, client_id, to_email, subject, body, status, scheduled_at, sent_at, error")
    .eq("organization_id", user.organization.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const [clients, templates] = await Promise.all([
    rows.length ? supabase.from("clients").select("id, full_name").in("id", [...new Set(rows.map((r) => r.client_id))]) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    listEmailTemplates(user),
  ]);
  const name = new Map((clients.data ?? []).map((c) => [c.id as string, c.full_name as string]));
  const tname = new Map(templates.map((t) => [t.id, t.name]));
  return rows.map((r) => ({
    id: r.id,
    templateName: r.template_id ? (tname.get(r.template_id) ?? null) : null,
    client: { id: r.client_id, name: name.get(r.client_id) ?? "Ügyfél" },
    toEmail: r.to_email,
    subject: r.subject,
    body: r.body,
    status: r.status,
    scheduledAt: r.scheduled_at,
    sentAt: r.sent_at,
    error: r.error,
  }));
}

export async function waitingCount(user: CurrentUser) {
  const supabase = await db();
  const { count } = await supabase.from("email_outbox").select("id", { count: "exact", head: true }).eq("organization_id", user.organization.id).eq("status", "awaiting_approval");
  return count ?? 0;
}

export async function updateOutbox(user: CurrentUser, id: string, patch: { subject?: string; body?: string; status?: "queued" | "cancelled" }) {
  if (!UUID.test(id)) return;
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.subject != null) row.subject = patch.subject.slice(0, 300);
  if (patch.body != null) row.body = patch.body.slice(0, 20_000);
  if (patch.status) row.status = patch.status;
  await supabase.from("email_outbox").update(row).eq("id", id).eq("organization_id", user.organization.id).in("status", ["awaiting_approval", "queued", "failed"]);
}

/** Sends one message now, from the user's mailbox. */
export async function sendOutboxItem(user: CurrentUser, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Ismeretlen levél." };
  const supabase = await db();
  const { data: m } = await supabase
    .from("email_outbox")
    .select("id, client_id, property_id, to_email, subject, body, status")
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (!m || m.status === "sent" || m.status === "cancelled") return { ok: false, error: "Ez a levél már nem küldhető." };
  const r = await sendNewEmail(user, { to: m.to_email, subject: m.subject, body: m.body, clientId: m.client_id, propertyId: m.property_id, followUpDays: null, taskTitle: "" }, new Date());
  await supabase
    .from("email_outbox")
    .update(r.ok ? { status: "sent", sent_at: r.sentAt, error: null } : { status: "failed", error: r.error.slice(0, 500) })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
