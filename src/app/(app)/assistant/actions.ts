"use server";

import { z } from "zod";
import { AiError } from "@/lib/ai/extract";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { askAssistant } from "@/lib/assistant/run";
import type { Source } from "@/lib/assistant/tools";
import { getCurrentUser } from "@/lib/auth";

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
  .min(1)
  .max(20)
  .refine((h) => h[h.length - 1].role === "user", "The last message must be the question.");

export type AskResult = { ok: true; answer: string; sources: Source[] } | { ok: false; error: string };

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
    return { ok: true, answer: result.answer, sources: result.sources };
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error", operation: "assistant" });
      console.error("assistant", error.message);
      return { ok: false, error: error.userMessage };
    }
    throw error;
  }
}
