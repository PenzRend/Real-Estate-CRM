"use server";

import { refresh } from "next/cache";
import { AiError } from "@/lib/ai/extract";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { AD_STYLES, writeListingText, type AdStyle } from "@/lib/listings/ad-writer";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function writeAdAction(propertyId: string, style: string) {
  if (!UUID.test(propertyId)) return { ok: false as const, error: "Ismeretlen ingatlan." };
  const user = await getCurrentUser();
  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false as const, error: limit };
  try {
    const r = await writeListingText(user, propertyId, (style in AD_STYLES ? style : "standard") as AdStyle, new Date());
    await logAiUsage(user, { status: "success", operation: "next_actions", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    return { ok: true as const, title: r.title, description: r.description, missing: r.missing };
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error", operation: "next_actions" });
      return { ok: false as const, error: error.userMessage };
    }
    throw error;
  }
}

/** Saves the reviewed text as the listing's description (and, if asked, the headline as its title). */
export async function saveAdAction(propertyId: string, description: string, title: string | null) {
  if (!UUID.test(propertyId)) return { ok: false as const, error: "Ismeretlen ingatlan." };
  const text = String(description ?? "").trim();
  if (!text || text.length > 20_000) return { ok: false as const, error: "A leírás üres vagy túl hosszú." };
  const headline = typeof title === "string" ? title.trim().slice(0, 300) : "";
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({ description: text, ...(headline ? { title: headline } : {}) })
    .eq("id", propertyId)
    .eq("organization_id", user.organization.id);
  if (error) return { ok: false as const, error: "A mentés nem sikerült. Próbáld újra." };
  refresh();
  return { ok: true as const };
}
