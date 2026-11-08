import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { createClient } from "@/lib/supabase/server";

// Per-user limits on expensive AI calls, enforced on the server.
const LIMITS = { perHour: 60, perDay: 300 };

/**
 * AI calls a workspace may make in a calendar month, unless the platform admin
 * set its own number (organizations.ai_monthly_limit). AI_MONTHLY_LIMIT on the
 * server; empty means no monthly cap.
 */
export function defaultMonthlyLimit(): number | null {
  const n = Number.parseInt(process.env.AI_MONTHLY_LIMIT ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** First moment of the current month, Budapest time, as an ISO string. */
export function monthStart(now = new Date()) {
  return zonedLocalToUtc(`${utcToZonedLocal(now.toISOString()).slice(0, 7)}-01T00:00`)!;
}

/** This month's AI calls of the user's workspace, and its cap (null: none). */
export async function monthlyAiUsage(user: CurrentUser): Promise<{ used: number; limit: number | null }> {
  const supabase = await createClient();
  const [used, org] = await Promise.all([
    supabase
      .from("ai_processing_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.organization.id)
      .neq("status", "rejected")
      .gte("created_at", monthStart()),
    supabase.from("organizations").select("ai_monthly_limit").eq("id", user.organization.id).maybeSingle(),
  ]);
  const own = (org.data as { ai_monthly_limit: number | null } | null)?.ai_monthly_limit;
  return { used: used.count ?? 0, limit: own ?? defaultMonthlyLimit() };
}

/** Returns a Hungarian message when the user is over the limit, otherwise null. */
export async function aiLimitMessage(user: CurrentUser): Promise<string | null> {
  const supabase = await createClient();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const [day, hour, month] = await Promise.all([
    supabase.from("ai_processing_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayAgo),
    supabase.from("ai_processing_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", hourAgo),
    monthlyAiUsage(user),
  ]);
  if (month.limit !== null && month.used >= month.limit) {
    return "Elfogyott a munkaterület havi AI-kerete. A hónap elején újraindul; ha előbb kell, írj nekünk a Visszajelzés gombbal.";
  }
  if ((hour.count ?? 0) >= LIMITS.perHour) return "Elérted az óránkénti AI-keretet. Próbáld újra egy kicsit később.";
  if ((day.count ?? 0) >= LIMITS.perDay) return "Elérted a napi AI-keretet. Holnap újra használhatod.";
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
