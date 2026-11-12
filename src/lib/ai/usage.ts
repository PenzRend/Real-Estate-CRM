import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { startOfZonedDay, utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { hasAccess } from "@/lib/billing/access";
import { workspaceBilling } from "@/lib/billing/data";
import { createClient } from "@/lib/supabase/server";

// Per-user limit on bursts of expensive AI calls, enforced on the server.
const PER_HOUR = 60;

const parseLimit = (v: string | undefined) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * AI calls a workspace may make in a calendar month, unless the platform admin
 * set its own number (organizations.ai_monthly_limit). AI_MONTHLY_LIMIT on the
 * server; empty means no monthly cap.
 */
export function defaultMonthlyLimit(): number | null {
  return parseLimit(process.env.AI_MONTHLY_LIMIT);
}

/**
 * AI calls a workspace may make in a day (Budapest time), unless the admin set
 * its own (organizations.ai_daily_limit). The provider's free tier is counted
 * per day and shared by all workspaces, so there is always a default: 100.
 */
export function defaultDailyLimit(): number {
  return parseLimit(process.env.AI_DAILY_LIMIT) ?? 100;
}

/** First moment of the current month, Budapest time, as an ISO string. */
export function monthStart(now = new Date()) {
  return zonedLocalToUtc(`${utcToZonedLocal(now.toISOString()).slice(0, 7)}-01T00:00`)!;
}

/** First moment of today, Budapest time, as an ISO string. */
export function dayStart(now = new Date()) {
  return startOfZonedDay(now).toISOString();
}

export type AiUsage = { today: number; dailyLimit: number; month: number; monthlyLimit: number | null };

/** Today's and this month's AI calls of the user's workspace, with its caps. */
export async function aiUsage(user: CurrentUser): Promise<AiUsage> {
  const supabase = await createClient();
  const count = (since: string) =>
    supabase
      .from("ai_processing_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.organization.id)
      .neq("status", "rejected")
      .gte("created_at", since);
  // "*": the billing columns may not exist yet on an older database.
  const [today, month, org] = await Promise.all([count(dayStart()), count(monthStart()), supabase.from("organizations").select("*").eq("id", user.organization.id).maybeSingle()]);
  const own = org.data as { ai_daily_limit: number | null; ai_monthly_limit: number | null; billing_status?: string; plan_id?: string | null; seats?: number | null } | null;
  // A paying workspace gets its plan's caps times its seats; pilots and trials the server defaults.
  let planDaily: number | null = null;
  let planMonthly: number | null = null;
  if (own?.plan_id && (own.billing_status === "active" || own.billing_status === "past_due" || own.billing_status === "canceled")) {
    const { data: plan } = await supabase.from("plans").select("ai_daily_per_seat, ai_monthly_per_seat").eq("id", own.plan_id).maybeSingle();
    const p = plan as { ai_daily_per_seat: number; ai_monthly_per_seat: number | null } | null;
    const seats = Math.max(1, own.seats ?? 1);
    if (p) {
      planDaily = p.ai_daily_per_seat * seats;
      planMonthly = p.ai_monthly_per_seat === null ? null : p.ai_monthly_per_seat * seats;
    }
  }
  return {
    today: today.count ?? 0,
    dailyLimit: own?.ai_daily_limit ?? planDaily ?? defaultDailyLimit(),
    month: month.count ?? 0,
    monthlyLimit: own?.ai_monthly_limit ?? (planDaily !== null ? planMonthly : defaultMonthlyLimit()),
  };
}

/** Returns a Hungarian message when the user is over the limit, otherwise null. */
export async function aiLimitMessage(user: CurrentUser): Promise<string | null> {
  const supabase = await createClient();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const [hour, usage, billing] = await Promise.all([
    supabase.from("ai_processing_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", hourAgo),
    aiUsage(user),
    workspaceBilling(user),
  ]);
  if (!hasAccess(billing)) return "Az AI-funkciókhoz aktív előfizetés kell. Az Előfizetés oldalon tudod rendezni.";
  if (usage.monthlyLimit !== null && usage.month >= usage.monthlyLimit) {
    return "Elfogyott a munkaterület havi AI-kerete. A hónap elején újraindul; ha előbb kell, írj nekünk a Visszajelzés gombbal.";
  }
  if (usage.today >= usage.dailyLimit) return "Elfogyott a munkaterület mai AI-kerete. Éjfélkor újraindul.";
  if ((hour.count ?? 0) >= PER_HOUR) return "Elérted az óránkénti AI-keretet. Próbáld újra egy kicsit később.";
  return null;
}

/** Records that an AI call happened. Metadata only, never the note content. */
export async function logAiUsage(
  user: CurrentUser,
  entry: {
    status: "success" | "error" | "rejected";
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    /** Reply drafts are logged as "next_actions" (the schema's existing operation type). */
    operation?: "extract_interaction" | "assistant" | "next_actions";
  },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_processing_logs").insert({
    organization_id: user.organization.id,
    user_id: user.id,
    operation_type: entry.operation ?? "extract_interaction",
    status: entry.status,
    model: entry.model ?? null,
    input_tokens: entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
  });
  if (error) console.error("logAiUsage failed", error.code);
}
