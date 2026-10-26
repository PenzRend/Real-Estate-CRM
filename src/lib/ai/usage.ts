import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Per-user limits on expensive AI calls, enforced on the server.
const LIMITS = { perHour: 60, perDay: 300 };

/** Returns a Hungarian message when the user is over the limit, otherwise null. */
export async function aiLimitMessage(user: CurrentUser): Promise<string | null> {
  const supabase = await createClient();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const [day, hour] = await Promise.all([
    supabase.from("ai_processing_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayAgo),
    supabase.from("ai_processing_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", hourAgo),
  ]);
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
    operation?: "extract_interaction" | "assistant";
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
