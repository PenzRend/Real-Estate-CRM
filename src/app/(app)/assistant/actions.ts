"use server";

import { z } from "zod";
import { AiError } from "@/lib/ai/extract";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { refresh } from "next/cache";
import { runConfirmation, type Confirmation } from "@/lib/assistant/actions";
import { askAssistant } from "@/lib/assistant/run";
import type { Source } from "@/lib/assistant/tools";
import { getCurrentUser } from "@/lib/auth";

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
  .min(1)
  .max(20)
  .refine((h) => h[h.length - 1].role === "user", "The last message must be the question.");

export type AskResult = { ok: true; answer: string; sources: Source[]; confirmations: Confirmation[]; navigate: string | null } | { ok: false; error: string };

/** One assistant turn. The conversation lives in the browser; nothing is stored except usage metadata. */
export async function askAssistantAction(history: unknown): Promise<AskResult> {
  const user = await getCurrentUser();
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) return { ok: false, error: "A kérdés üres vagy túl hosszú." };

  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };

  try {
    // Only the last 10 turns: enough context, bounded cost.
    const result = await askAssistant(user, parsed.data.slice(-10), new Date());
    await logAiUsage(user, {
      status: "success",
      operation: "assistant",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    // The assistant created or changed something: the open page shows it.
    if (result.changed) refresh();
    return { ok: true, answer: result.answer, sources: result.sources, confirmations: result.confirmations, navigate: result.navigate };
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error", operation: "assistant" });
      console.error("assistant", error.message);
      return { ok: false, error: error.userMessage };
    }
    throw error;
  }
}

/** The agent confirmed a step the assistant prepared (a viewing, a deal move). */
export async function confirmAssistantAction(token: unknown) {
  const user = await getCurrentUser();
  if (typeof token !== "string" || token.length > 4000) return { ok: false as const, error: "Ez a jóváhagyás már nem érvényes." };
  const r = await runConfirmation(user, token, new Date());
  if (r.ok) refresh();
  return r;
}
