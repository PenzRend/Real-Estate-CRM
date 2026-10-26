"use server";

import { z } from "zod";
import { AiError } from "@/lib/ai/extract";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { generateDraft, markVisit, type AwayDraft } from "@/lib/away/data";
import { sendReply, type SendResult } from "@/lib/mail/send";
import { getMailbox, syncMailbox } from "@/lib/mail/sync";

/** Called once the dashboard is on screen, so the next "away" window starts here. */
export async function markVisitAction() {
  const user = await getCurrentUser();
  await markVisit(user, new Date());
}

const STALE_MS = 5 * 60_000;

/** Fetches new mail when the last sync is older than a few minutes. Returns how many emails were stored. */
export async function syncIfStaleAction(): Promise<number> {
  const user = await getCurrentUser();
  const mailbox = await getMailbox(user);
  if (!mailbox || mailbox.status === "revoked") return 0;
  if (mailbox.last_synced_at && Date.now() - new Date(mailbox.last_synced_at).getTime() < STALE_MS) return 0;
  const r = await syncMailbox(user);
  return r.ok ? r.stored : 0;
}

export type DraftActionResult = { ok: true; draft: AwayDraft } | { ok: false; error: string };

export async function draftReplyAction(emailId: string): Promise<DraftActionResult> {
  const user = await getCurrentUser();
  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };
  try {
    const r = await generateDraft(user, emailId, new Date());
    if (!r.ok) return r;
    await logAiUsage(user, { status: "success", operation: "next_actions", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    return { ok: true, draft: r.draft };
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error", operation: "next_actions" });
      console.error("reply draft", error.message);
      return { ok: false, error: error.userMessage };
    }
    throw error;
  }
}

const sendSchema = z.object({
  emailId: z.string(),
  to: z.string().max(2000),
  subject: z.string().max(1000),
  body: z.string().max(20_000),
  followUpDays: z.number().int().min(1).max(30).nullable(),
});

/** Sends one reply the user reviewed, through their own Gmail. Only called from the "Küldés" confirmation. */
export async function sendReplyAction(input: unknown): Promise<SendResult> {
  const user = await getCurrentUser();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Hiányos levél." };
  return sendReply(user, parsed.data, new Date());
}
