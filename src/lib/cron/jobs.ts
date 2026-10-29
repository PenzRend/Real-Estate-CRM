import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncMailbox, type Arrival } from "@/lib/mail/sync";
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
  const result = job === "mail" ? await mailJob(admin) : await dailyJob(now);
  return { job, ...result, ms: Date.now() - started };
}

/** Once a morning: filled in by the reminder and report features. */
async function dailyJob(now: Date): Promise<JobResult> {
  return { day: now.toISOString().slice(0, 10) };
}
