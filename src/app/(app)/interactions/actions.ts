"use server";

import { redirect } from "next/navigation";
import { AiError, extractCapture } from "@/lib/ai/extract";
import type { CaptureExtraction } from "@/lib/ai/capture-schema";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import {
  findClientCandidates,
  saveCapture,
  saveManualInteraction,
  SaveError,
  type ClientSnapshot,
} from "@/lib/db/activity";
import { captureSaveSchema, parseInteractionForm, type InteractionFieldErrors } from "@/lib/validation/activity";

// ---------------------------------------------------------------------------
// Manual entry
// ---------------------------------------------------------------------------

export type InteractionFormState = {
  errors?: InteractionFieldErrors;
  formError?: string;
  values?: Record<string, string>;
};

export async function createInteractionAction(_: InteractionFormState, formData: FormData): Promise<InteractionFormState> {
  const user = await getCurrentUser();
  const values = Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const parsed = parseInteractionForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values };

  let saved;
  try {
    saved = await saveManualInteraction(user, parsed.data);
  } catch (error) {
    if (error instanceof SaveError) return { formError: error.userMessage, values };
    throw error;
  }
  redirect(saved.clientId ? `/clients/${saved.clientId}` : `/properties/${parsed.data.property_id}`);
}

// ---------------------------------------------------------------------------
// AI capture: analyze (nothing saved), then save what the agent confirmed
// ---------------------------------------------------------------------------

export type AnalyzeResult =
  | { ok: true; extraction: CaptureExtraction; candidates: ClientSnapshot[] }
  | { ok: false; error: string };

const MAX_NOTE_CHARS = 20_000;

export async function analyzeCaptureAction(input: {
  text: string;
  clientId?: string | null;
  hint?: "email" | "portal" | null;
}): Promise<AnalyzeResult> {
  const user = await getCurrentUser();
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (!text) return { ok: false, error: "Írj vagy mondj be egy jegyzetet." };
  if (text.length > MAX_NOTE_CHARS) return { ok: false, error: "A jegyzet túl hosszú (legfeljebb 20 000 karakter)." };

  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };

  // When recording from a client's page, that client is the first candidate.
  const pinned = typeof input.clientId === "string" ? input.clientId : null;
  const pinnedName = pinned ? (await findClientCandidates(user, { full_name: null, phone: null, email: null }, pinned))[0] : null;

  try {
    const hint = input.hint === "email" || input.hint === "portal" ? input.hint : null;
    const result = await extractCapture(text, new Date(), pinnedName?.full_name, hint);
    await logAiUsage(user, {
      status: "success",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    const candidates = await findClientCandidates(user, result.extraction.client, pinnedName?.id);
    return { ok: true, extraction: result.extraction, candidates };
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error" });
      console.error("analyzeCaptureAction", error.message);
      return { ok: false, error: error.userMessage };
    }
    throw error;
  }
}

export type SaveCaptureResult = { ok: false; error: string };

export async function saveCaptureAction(payload: unknown): Promise<SaveCaptureResult> {
  const user = await getCurrentUser();
  const parsed = captureSaveSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Hiányos adatok. Ellenőrizd a mezőket." };
  }
  let saved;
  try {
    saved = await saveCapture(user, parsed.data);
  } catch (error) {
    if (error instanceof SaveError) return { ok: false, error: error.userMessage };
    throw error;
  }
  redirect(`/clients/${saved.clientId}?saved=1`);
}
