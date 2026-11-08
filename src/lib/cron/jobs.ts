import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncMailbox, type Arrival } from "@/lib/mail/sync";
import { draftReport, dueWeeklyReports, sendReport } from "@/lib/reports/data";
import { dueReminders, sendViewingReminder } from "@/lib/viewings/reminders";
import { chatNoticeText, chatRecipients } from "@/lib/chat/notify";
import { enqueueForEvent, sendOutboxItem } from "@/lib/email-auto/outbox";
import { arrivalsMessage } from "@/lib/push/messages";
import { weekSummary } from "@/lib/team/week-summary";
import { weekLine } from "@/lib/team/week-text";
import { pushToUser } from "@/lib/push/server";
import { morningMessage, todaysViewings } from "@/lib/viewings/day";
import { asBackgroundJob } from "@/lib/supabase/db";
import { jobUser } from "./job-user";

// The background jobs behind /api/cron. Each runs for every workspace with the
// admin client, acting as each agent in turn (their mailboxes, their data).

export const CRON_JOBS = ["mail", "daily"] as const;
export type CronJob = (typeof CRON_JOBS)[number];

type JobResult = Record<string, number | string>;

/** Runs `fn` on the items, a few at a time. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/**
 * Every connected mailbox is checked for new mail; whoever got a portal
 * inquiry or a client's email gets a notification on their devices.
 */
async function mailJob(admin: SupabaseClient): Promise<JobResult> {
  const { data: mailboxes, error } = await admin.from("mailboxes").select("id, user_id, organization_id").neq("status", "revoked").limit(5000);
  if (error) throw new Error(`mailboxes: ${error.message}`);
  const arrivals = new Map<string, Arrival[]>();
  let synced = 0;
  let failed = 0;
  await inBatches(mailboxes ?? [], 4, async (m) => {
    const user = await jobUser(admin, m.user_id, m.organization_id);
    if (!user) return;
    const r = await asBackgroundJob(admin, () => syncMailbox(user, m.id)).catch((e) => {
      console.error("cron mail sync failed", e instanceof Error ? e.message : e);
      return null;
    });
    if (!r?.ok) {
      failed++;
      return;
    }
    synced++;
    if (r.arrivals.length) arrivals.set(m.user_id, [...(arrivals.get(m.user_id) ?? []), ...r.arrivals]);
  });
  let notified = 0;
  for (const [userId, list] of arrivals) {
    const message = arrivalsMessage(list);
    if (message) notified += await asBackgroundJob(admin, () => pushToUser(userId, message));
  }
  return {
    synced,
    failed,
    newEmails: [...arrivals.values()].reduce((n, l) => n + l.length, 0),
    notified,
    leadsAnnounced: await announceNewLeads(admin),
    chatNotified: await announceChatMessages(admin),
    feedbackPrompts: await feedbackPrompts(admin, new Date()),
    emailsSent: await sendDueOutbox(admin),
  };
}

/** Automatic emails whose time has come (approved, or set to go by themselves), from each agent's mailbox. */
async function sendDueOutbox(admin: SupabaseClient): Promise<number> {
  const { data: due } = await admin
    .from("email_outbox")
    .select("id, user_id, organization_id")
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(100);
  let sent = 0;
  for (const m of due ?? []) {
    const user = await jobUser(admin, m.user_id, m.organization_id);
    if (!user) {
      await admin.from("email_outbox").update({ status: "failed", error: "A küldő már nem tagja a munkaterületnek." }).eq("id", m.id);
      continue;
    }
    const r = await asBackgroundJob(admin, () => sendOutboxItem(user, m.id)).catch(() => ({ ok: false as const }));
    if (r.ok) sent++;
  }
  return sent;
}

/** "Ha régóta nem beszéltünk": clients past the rule's quiet days get one message per quiet spell. */
async function noContactJob(admin: SupabaseClient, now: Date): Promise<JobResult> {
  const { data: rules } = await admin.from("email_templates").select("organization_id, no_contact_days").eq("active", true).eq("trigger", "no_contact");
  let queued = 0;
  for (const rule of rules ?? []) {
    const days = rule.no_contact_days ?? 21;
    const before = new Date(now.getTime() - days * 86_400_000).toISOString();
    const { data: clients } = await admin
      .from("clients")
      .select("id, assigned_to, created_by, last_contacted_at")
      .eq("organization_id", rule.organization_id)
      .is("archived_at", null)
      .not("email", "is", null)
      .not("status", "in", "(converted,lost)")
      .lt("last_contacted_at", before)
      .limit(50);
    for (const c of clients ?? []) {
      const agent = (c.assigned_to ?? c.created_by) as string | null;
      if (!agent) continue;
      const user = await jobUser(admin, agent, rule.organization_id);
      if (!user) continue;
      queued += await asBackgroundJob(admin, () => enqueueForEvent(user, "no_contact", { clientId: c.id }, `no-contact:${c.id}:${String(c.last_contacted_at).slice(0, 10)}`)).catch(() => 0);
    }
  }
  return { noContactQueued: queued };
}

/**
 * Direct messages and @mentions from the last day that nobody was told about
 * yet: a notification to each addressee who hasn't read them in the app.
 */
async function announceChatMessages(admin: SupabaseClient): Promise<number> {
  const { data: fresh } = await admin
    .from("chat_messages")
    .select("id, organization_id, sender_id, recipient_id, body, ref_kind, created_at")
    .is("notified_at", null)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .order("created_at")
    .limit(500);
  if (!fresh?.length) return 0;
  const orgs = [...new Set(fresh.map((m) => m.organization_id as string))];
  const [{ data: members }, { data: reads }] = await Promise.all([
    admin.from("organization_members").select("organization_id, user_id, profiles (full_name, email)").in("organization_id", orgs),
    admin.from("chat_reads").select("user_id, organization_id, peer, last_read_at").in("organization_id", orgs),
  ]);
  type P = { full_name: string | null; email: string };
  const people = (members ?? []).map((m) => ({ org: m.organization_id as string, id: m.user_id as string, p: [m.profiles].flat()[0] as P | undefined }));
  const readAt = new Map((reads ?? []).map((r) => [`${r.user_id}|${r.organization_id}|${r.peer}`, r.last_read_at as string]));
  let sent = 0;
  for (const m of fresh) {
    const inOrg = people.filter((x) => x.org === m.organization_id);
    const ids = new Set(inOrg.map((x) => x.id));
    const nameOf = (id: string) => {
      const p = inOrg.find((x) => x.id === id)?.p;
      return p ? p.full_name || p.email : undefined;
    };
    const sender = inOrg.find((x) => x.id === m.sender_id)?.p;
    const senderName = sender?.full_name || sender?.email || "Egy kollégád";
    const peer = m.recipient_id ? (m.sender_id as string) : "office";
    for (const n of chatRecipients({ senderId: m.sender_id, recipientId: m.recipient_id, body: m.body }, ids)) {
      const seen = readAt.get(`${n.userId}|${m.organization_id}|${peer}`);
      if (seen && Date.parse(seen) >= Date.parse(m.created_at)) continue; // already read in the app
      const text = chatNoticeText(n, senderName, { body: m.body, refKind: m.ref_kind, recipientId: m.recipient_id }, nameOf);
      sent += await asBackgroundJob(admin, () => pushToUser(n.userId, { ...text, url: `/messages?with=${peer}`, tag: `chat-${peer}` }));
    }
    await admin.from("chat_messages").update({ notified_at: new Date().toISOString() }).eq("id", m.id);
  }
  return sent;
}

/** A client given to an agent by someone else (or by the rotation): a notification to that agent, once. */
async function announceNewLeads(admin: SupabaseClient): Promise<number> {
  const { data: fresh } = await admin
    .from("clients")
    .select("id, full_name, assigned_to, created_by, lead_source")
    .is("lead_notified_at", null)
    .not("assigned_to", "is", null)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .limit(500);
  let sent = 0;
  for (const c of fresh ?? []) {
    if (c.assigned_to !== c.created_by) {
      sent += await asBackgroundJob(admin, () =>
        pushToUser(c.assigned_to as string, { title: `Új ügyfelet kaptál: ${c.full_name}`, body: c.lead_source ? `Forrás: ${c.lead_source}` : "Nézd meg, és vedd fel vele a kapcsolatot.", url: `/clients/${c.id}`, tag: `lead-${c.id}` }),
      );
    }
    await admin.from("clients").update({ lead_notified_at: new Date().toISOString() }).eq("id", c.id);
  }
  return sent;
}

export async function runCronJob(admin: SupabaseClient, job: CronJob, now: Date): Promise<JobResult> {
  const started = Date.now();
  const result = job === "mail" ? await mailJob(admin) : await dailyJob(admin, now);
  return { job, ...result, ms: Date.now() - started };
}

/** Monday mornings: the weekly seller reports that are switched on, sent from each listing's agent. */
async function sellerReportsJob(admin: SupabaseClient, now: Date): Promise<JobResult> {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Budapest" }).format(now);
  if (weekday !== "Mon") return { sellerReports: "not Monday" };
  const due = await asBackgroundJob(admin, () => dueWeeklyReports(now));
  let sent = 0;
  let failed = 0;
  for (const d of due) {
    const user = await jobUser(admin, d.agentId, d.organizationId);
    if (!user) continue;
    await asBackgroundJob(admin, async () => {
      const draft = await draftReport(user, d.propertyId, now);
      const r = draft.ok ? await sendReport(user, draft.report.id, null, now) : draft;
      if (r.ok) sent++;
      else {
        failed++;
        await pushToUser(user.id, { title: "Az eladói riport nem ment el", body: r.error, url: `/properties/${d.propertyId}`, tag: `report-${d.propertyId}` });
      }
    });
  }
  return { sellerReports: sent, sellerReportsFailed: failed };
}

/** Tomorrow's viewings: a reminder to each client, from the agent who booked it. */
async function viewingRemindersJob(admin: SupabaseClient, now: Date): Promise<JobResult> {
  const due = await asBackgroundJob(admin, () => dueReminders(now));
  let sent = 0;
  let failed = 0;
  for (const d of due) {
    const user = await jobUser(admin, d.agentId, d.organizationId);
    if (!user) continue;
    const r = await asBackgroundJob(admin, () => sendViewingReminder(user, d.viewingId, now));
    if (r.ok) sent++;
    else failed++;
  }
  return { viewingReminders: sent, viewingRemindersFailed: failed };
}

/** Once a morning (7:00): tomorrow's viewing reminders, and the weekly seller reports on Mondays. */
async function dailyJob(admin: SupabaseClient, now: Date): Promise<JobResult> {
  return {
    ...(await viewingRemindersJob(admin, now)),
    ...(await sellerReportsJob(admin, now)),
    ...(await officeWeekJob(admin, now)),
    ...(await noContactJob(admin, now)),
    ...(await morningBriefJob(admin, now)),
  };
}

type ViewingRow = {
  id: string;
  organization_id: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  location: string | null;
  agent: string | null;
  client_id: string;
  property_id: string;
};

/** Names and places for viewings, in a shape lib/viewings/day understands. */
async function dayViewings(admin: SupabaseClient, rows: ViewingRow[]) {
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const [{ data: clients }, { data: properties }] = await Promise.all([
    clientIds.length ? admin.from("clients").select("id, full_name, phone").in("id", clientIds) : Promise.resolve({ data: [] }),
    propertyIds.length ? admin.from("properties").select("id, title, postal_code, city, district, address").in("id", propertyIds) : Promise.resolve({ data: [] }),
  ]);
  const c = new Map((clients ?? []).map((x: { id: string; full_name: string; phone: string | null }) => [x.id, x]));
  const p = new Map(
    (properties ?? []).map((x: { id: string; title: string; postal_code: string | null; city: string | null; district: string | null; address: string | null }) => [
      x.id,
      { name: x.title, address: [[x.postal_code, x.city].filter(Boolean).join(" "), x.district, x.address].filter(Boolean).join(", ") || null },
    ]),
  );
  return rows.map((r) => ({
    id: r.id,
    agent: r.agent,
    startsAt: r.starts_at,
    durationMinutes: r.duration_minutes,
    status: r.status,
    location: r.location,
    client: { name: c.get(r.client_id)?.full_name ?? "Ügyfél", phone: c.get(r.client_id)?.phone ?? null },
    property: p.get(r.property_id) ?? { name: "Ingatlan", address: null },
  }));
}

const VIEWING_COLUMNS = "id, organization_id, starts_at, duration_minutes, status, location, calendar_user_id, created_by, client_id, property_id";
const withAgent = (r: Record<string, unknown>): ViewingRow => ({ ...(r as unknown as ViewingRow), agent: (r.calendar_user_id ?? r.created_by ?? null) as string | null });

/**
 * 7:00, to every agent with notifications on: "Jó reggelt! Ma: 3 megtekintés,
 * az első 10:00 – Bartók Béla út · 4 teendő". Nothing on an empty day.
 */
async function morningBriefJob(admin: SupabaseClient, now: Date): Promise<JobResult> {
  const { data: devices } = await admin.from("push_subscriptions").select("user_id").limit(10_000);
  const users = [...new Set((devices ?? []).map((d) => d.user_id as string))];
  if (!users.length) return { morningBriefs: 0 };
  const { data: rows } = await admin
    .from("viewings")
    .select(VIEWING_COLUMNS)
    .eq("status", "scheduled")
    .gte("starts_at", new Date(now.getTime() - 86_400_000).toISOString())
    .lte("starts_at", new Date(now.getTime() + 2 * 86_400_000).toISOString())
    .limit(5000);
  const viewings = todaysViewings(await dayViewings(admin, (rows ?? []).map(withAgent)), now);
  const endOfDay = new Date(now.getTime() + 18 * 3600_000).toISOString();
  let sent = 0;
  for (const userId of users) {
    const { count } = await admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["todo", "in_progress"])
      .lte("due_at", endOfDay)
      .or(`assigned_to.eq.${userId},and(assigned_to.is.null,created_by.eq.${userId})`);
    const message = morningMessage(
      viewings.filter((v) => v.agent === userId),
      count ?? 0,
    );
    if (!message) continue;
    sent += await asBackgroundJob(admin, () => pushToUser(userId, { ...message, url: "/dashboard", tag: "morning" })).catch(() => 0);
  }
  return { morningBriefs: sent };
}

/** Right after a viewing ends (within the hour): "Hogy sikerült?" to its agent, once; the notification opens the feedback. */
async function feedbackPrompts(admin: SupabaseClient, now: Date): Promise<number> {
  const { data: rows } = await admin
    .from("viewings")
    .select(VIEWING_COLUMNS)
    .eq("status", "scheduled")
    .is("feedback_prompted_at", null)
    .gte("starts_at", new Date(now.getTime() - 8 * 3600_000).toISOString())
    .lte("starts_at", now.toISOString())
    .limit(200);
  const ended = (await dayViewings(admin, (rows ?? []).map(withAgent))).filter((v) => {
    const end = new Date(v.startsAt).getTime() + v.durationMinutes * 60_000;
    return end <= now.getTime() && end > now.getTime() - 3600_000;
  });
  let sent = 0;
  for (const v of ended) {
    // Marked first, so a slow push never asks twice.
    await admin.from("viewings").update({ feedback_prompted_at: now.toISOString() }).eq("id", v.id);
    if (!v.agent) continue;
    sent += await asBackgroundJob(admin, () =>
      pushToUser(v.agent!, { title: "Hogy sikerült a megtekintés?", body: `${v.client.name} – ${v.property.name}`, url: `/dashboard?feedback=${v.id}`, tag: `feedback-${v.id}` }),
    ).catch(() => 0);
  }
  return sent;
}

/** Monday mornings: last week's office numbers to every owner and admin of a team (two or more members). */
async function officeWeekJob(admin: SupabaseClient, now: Date): Promise<JobResult> {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Budapest" }).format(now);
  if (weekday !== "Mon") return { officeWeek: "not Monday" };
  const { data: members } = await admin.from("organization_members").select("organization_id, user_id, role").limit(10_000);
  const size = new Map<string, number>();
  for (const m of members ?? []) size.set(m.organization_id, (size.get(m.organization_id) ?? 0) + 1);
  let sent = 0;
  for (const m of (members ?? []).filter((x) => x.role !== "member" && (size.get(x.organization_id) ?? 0) > 1)) {
    const user = await jobUser(admin, m.user_id, m.organization_id);
    if (!user) continue;
    await asBackgroundJob(admin, async () => {
      const s = await weekSummary(user, now);
      sent += await pushToUser(user.id, {
        title: s.star ? `Múlt hét az irodában – a hét csillaga: ${s.star.name}` : "Múlt hét az irodában",
        body: weekLine(s.week),
        url: "/dashboard",
        tag: `office-week-${s.from}`,
      });
    }).catch((e) => console.error("office week failed", e instanceof Error ? e.message : e));
  }
  return { officeWeek: sent };
}
