import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { sendNewEmail } from "@/lib/mail/send";
import { db } from "@/lib/supabase/db";
import { sellerReport, type SellerFacts } from "./seller";

// Weekly seller reports: the week's facts about a listing, a draft the agent
// can read and edit, and sending it from the agent's own mailbox. With
// "hetente automatikusan" on, the Monday-morning job drafts and sends it.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE = ["active", "reserved", "under_negotiation"];

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The last seven full days before `now`, in Budapest time. */
export function reportPeriod(now: Date) {
  const today = utcToZonedLocal(now.toISOString()).slice(0, 10);
  const end = addDays(today, -1);
  const start = addDays(end, -6);
  return { start, end, from: zonedLocalToUtc(`${start}T00:00`)!, to: zonedLocalToUtc(`${today}T00:00`)! };
}

export type ReportTarget = { propertyId: string; title: string; ownerId: string | null; ownerName: string | null; ownerEmail: string | null; weekly: boolean };

export async function reportTarget(user: CurrentUser, propertyId: string): Promise<ReportTarget | null> {
  if (!UUID.test(propertyId)) return null;
  const supabase = await db();
  const { data: p } = await supabase.from("properties").select("id, title, owner_client_id, seller_report_weekly").eq("id", propertyId).eq("organization_id", user.organization.id).maybeSingle();
  if (!p) return null;
  const { data: owner } = p.owner_client_id ? await supabase.from("clients").select("id, full_name, email").eq("id", p.owner_client_id).maybeSingle() : { data: null };
  return { propertyId: p.id, title: p.title, ownerId: owner?.id ?? null, ownerName: owner?.full_name ?? null, ownerEmail: owner?.email ?? null, weekly: p.seller_report_weekly };
}

async function gatherFacts(user: CurrentUser, propertyId: string, now: Date, agentName: string): Promise<SellerFacts | null> {
  const supabase = await db();
  const period = reportPeriod(now);
  const { data: p } = await supabase.from("properties").select("id, title, price, currency, created_at, owner_client_id").eq("id", propertyId).eq("organization_id", user.organization.id).maybeSingle();
  if (!p) return null;
  const [{ data: owner }, viewings, upcoming, inquiries, deals, share] = await Promise.all([
    p.owner_client_id ? supabase.from("clients").select("full_name").eq("id", p.owner_client_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("viewings").select("starts_at, status, interest, feedback").eq("property_id", propertyId).in("status", ["completed", "no_show"]).gte("starts_at", period.from).lt("starts_at", period.to).order("starts_at"),
    supabase.from("viewings").select("starts_at").eq("property_id", propertyId).eq("status", "scheduled").gte("starts_at", now.toISOString()).lt("starts_at", new Date(now.getTime() + 7 * 86_400_000).toISOString()).order("starts_at"),
    supabase.from("interactions").select("id", { count: "exact", head: true }).eq("property_id", propertyId).in("interaction_type", ["email", "call", "meeting"]).gte("occurred_at", period.from).lt("occurred_at", period.to),
    supabase.from("deals").select("id").eq("property_id", propertyId),
    supabase.from("property_shares").select("view_count").eq("property_id", propertyId).maybeSingle(),
  ]);
  const dealIds = (deals.data ?? []).map((d) => d.id as string);
  const { data: offers } = dealIds.length
    ? await supabase.from("deal_offers").select("amount, status, made_by").in("deal_id", dealIds).gte("made_on", period.start).lte("made_on", period.end).order("made_on")
    : { data: [] as { amount: number; status: SellerFacts["offers"][number]["status"]; made_by: "buyer" | "seller" }[] };
  const done = (viewings.data ?? []).filter((v) => v.status === "completed");
  return {
    ownerName: owner?.full_name ?? "Tulajdonos",
    propertyTitle: p.title,
    periodStart: period.start,
    periodEnd: period.end,
    askingPrice: p.price,
    currency: p.currency,
    daysOnMarket: Math.max(0, Math.floor((now.getTime() - Date.parse(p.created_at)) / 86_400_000)),
    viewings: done.map((v) => ({ date: utcToZonedLocal(v.starts_at).slice(0, 10), interest: v.interest, feedback: v.feedback })),
    noShows: (viewings.data ?? []).length - done.length,
    upcomingViewings: (upcoming.data ?? []).map((v) => ({ date: utcToZonedLocal(v.starts_at).slice(0, 10) })),
    inquiries: inquiries.count ?? 0,
    offers: (offers ?? []).map((o) => ({ amount: Number(o.amount), status: o.status, madeBy: o.made_by })),
    shareViews: share.data?.view_count ?? null,
    agentName,
  };
}

export type Report = { id: string; subject: string; body: string; status: "draft" | "sent" | "failed"; sentAt: string | null; createdAt: string; periodStart: string; periodEnd: string; error: string | null };

const REPORT_COLUMNS = "id, subject, body, status, sent_at, created_at, period_start, period_end, error";
const toReport = (r: Record<string, unknown>): Report => ({
  id: r.id as string,
  subject: r.subject as string,
  body: r.body as string,
  status: r.status as Report["status"],
  sentAt: (r.sent_at as string | null) ?? null,
  createdAt: r.created_at as string,
  periodStart: r.period_start as string,
  periodEnd: r.period_end as string,
  error: (r.error as string | null) ?? null,
});

export async function listReports(user: CurrentUser, propertyId: string): Promise<Report[]> {
  if (!UUID.test(propertyId)) return [];
  const supabase = await db();
  const { data } = await supabase.from("seller_reports").select(REPORT_COLUMNS).eq("property_id", propertyId).eq("organization_id", user.organization.id).order("created_at", { ascending: false }).limit(10);
  return (data ?? []).map(toReport);
}

/** A fresh draft from this week's facts (the agent reads and edits it before sending). */
export async function draftReport(user: CurrentUser, propertyId: string, now: Date): Promise<{ ok: true; report: Report } | { ok: false; error: string }> {
  const target = await reportTarget(user, propertyId);
  if (!target) return { ok: false, error: "Ismeretlen ingatlan." };
  if (!target.ownerId) return { ok: false, error: "Előbb add meg az ingatlan tulajdonosát (Szerkesztés → Tulajdonos)." };
  const facts = await gatherFacts(user, propertyId, now, user.fullName ?? "Az ingatlanosa");
  if (!facts) return { ok: false, error: "Ismeretlen ingatlan." };
  const { subject, body } = sellerReport(facts);
  const supabase = await db();
  const { data, error } = await supabase
    .from("seller_reports")
    .insert({ organization_id: user.organization.id, property_id: propertyId, client_id: target.ownerId, created_by: user.id, period_start: facts.periodStart, period_end: facts.periodEnd, subject, body })
    .select(REPORT_COLUMNS)
    .single();
  if (error || !data) {
    console.error("seller report draft failed", error?.code);
    return { ok: false, error: "A riportot nem sikerült elkészíteni." };
  }
  return { ok: true, report: toReport(data) };
}

/** Sends a report to the owner from the agent's mailbox, as edited; it lands on the owner's timeline too. */
export async function sendReport(user: CurrentUser, reportId: string, edits: { subject: string; body: string } | null, now: Date): Promise<{ ok: true } | { ok: false; error: string; needsPermission?: boolean }> {
  if (!UUID.test(reportId)) return { ok: false, error: "Ismeretlen riport." };
  const supabase = await db();
  const { data: r } = await supabase.from("seller_reports").select("id, property_id, client_id, subject, body, status").eq("id", reportId).eq("organization_id", user.organization.id).maybeSingle();
  if (!r || !r.client_id) return { ok: false, error: "A riporthoz nem tartozik tulajdonos." };
  if (r.status === "sent") return { ok: false, error: "Ez a riport már elment." };
  const { data: owner } = await supabase.from("clients").select("email").eq("id", r.client_id).maybeSingle();
  if (!owner?.email) return { ok: false, error: "A tulajdonosnak nincs e-mail-címe a Flavióban." };
  const subject = (edits?.subject ?? r.subject).trim().slice(0, 300);
  const body = (edits?.body ?? r.body).trim().slice(0, 20_000);
  const sent = await sendNewEmail(user, { to: owner.email, subject, body, clientId: r.client_id, propertyId: r.property_id, followUpDays: null, taskTitle: "" }, now);
  if (!sent.ok) {
    await supabase.from("seller_reports").update({ status: "failed", error: sent.error.slice(0, 500), subject, body }).eq("id", reportId);
    return sent;
  }
  await supabase.from("seller_reports").update({ status: "sent", sent_at: sent.sentAt, error: null, subject, body }).eq("id", reportId);
  return { ok: true };
}

export async function setWeeklyReport(user: CurrentUser, propertyId: string, on: boolean) {
  if (!UUID.test(propertyId)) return;
  const supabase = await db();
  const { error } = await supabase.from("properties").update({ seller_report_weekly: on }).eq("id", propertyId).eq("organization_id", user.organization.id);
  if (error) throw new Error(`weekly report switch failed: ${error.code}`);
}

/** Listings whose weekly report is due this morning: switched on, still on the market, with an owner, and not already reported in the last 6 days. */
export async function dueWeeklyReports(now: Date): Promise<{ propertyId: string; organizationId: string; agentId: string }[]> {
  const supabase = await db();
  const { data: props } = await supabase
    .from("properties")
    .select("id, organization_id, assigned_to, created_by, owner_client_id")
    .eq("seller_report_weekly", true)
    .in("status", ACTIVE)
    .is("archived_at", null)
    .not("owner_client_id", "is", null)
    .limit(2000);
  if (!props?.length) return [];
  const since = new Date(now.getTime() - 6 * 86_400_000).toISOString();
  const { data: recent } = await supabase.from("seller_reports").select("property_id").in("property_id", props.map((p) => p.id)).eq("status", "sent").gte("sent_at", since);
  const done = new Set((recent ?? []).map((r) => r.property_id as string));
  return props.flatMap((p) => {
    const agentId = (p.assigned_to ?? p.created_by) as string | null;
    return agentId && !done.has(p.id) ? [{ propertyId: p.id as string, organizationId: p.organization_id as string, agentId }] : [];
  });
}
