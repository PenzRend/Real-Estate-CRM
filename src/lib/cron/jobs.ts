import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncMailbox, type Arrival } from "@/lib/mail/sync";
import { draftReport, dueWeeklyReports, sendReport } from "@/lib/reports/data";
import { dueReminders, sendViewingReminder } from "@/lib/viewings/reminders";
import { arrivalsMessage } from "@/lib/push/messages";
import { pushToUser } from "@/lib/push/server";
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
  return { synced, failed, newEmails: [...arrivals.values()].reduce((n, l) => n + l.length, 0), notified };
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
  return { ...(await viewingRemindersJob(admin, now)), ...(await sellerReportsJob(admin, now)) };
}
