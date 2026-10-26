import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { structuredCall } from "@/lib/ai/structured";
import { createClient } from "@/lib/supabase/server";
import { extractionToFormValues, LISTING_SYSTEM_PROMPT, listingExtractionSchema, missingKeyFields } from "./extract-schema";
import { canonicalListingUrl, portalOf } from "./source";

export type ImportedRef = { id: string; title: string; archived: boolean };

/** Which of these listing addresses are already in the workspace (by canonical address). */
export async function findImported(user: CurrentUser, urls: string[]): Promise<Record<string, ImportedRef>> {
  const canonical = [...new Set(urls.map(canonicalListingUrl).filter(Boolean))] as string[];
  if (!canonical.length) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, title, source_url, archived_at")
    .eq("organization_id", user.organization.id)
    .in("source_url", canonical.slice(0, 200));
  if (error) throw new Error(`Failed to check imported listings: ${error.message}`);
  return Object.fromEntries((data ?? []).map((p) => [p.source_url as string, { id: p.id, title: p.title, archived: p.archived_at != null }]));
}

/**
 * Page text without blank lines and padding, so more of the listing fits.
 * Repeated lines stay: on parameter tables each label is followed by its
 * value ("Parkolás" / "nincs megadva"), and dropping a repeated value would
 * pair the label with the next label instead.
 */
export function compactText(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export type ListingDraft = {
  url: string;
  values: Record<string, string>;
  /** Key fields the page didn't state (Hungarian labels). */
  missing: string[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

/** Reads a listing page's text into property form values. Nothing is saved here. */
export async function extractListing(input: { url: string; text: string; structured?: string | null }): Promise<ListingDraft> {
  const url = canonicalListingUrl(input.url)!;
  const portal = portalOf(new URL(url));
  // Kept small: free AI tiers limit tokens per minute, and the facts are near the top.
  const prompt = `LISTING ADDRESS: ${url}
${input.structured ? `\nSTRUCTURED DATA FROM THE PAGE (JSON-LD):\n${input.structured.slice(0, 2000)}\n` : ""}
PAGE TEXT:
${compactText(input.text).slice(0, 8000)}`;
  const r = await structuredCall(listingExtractionSchema, LISTING_SYSTEM_PROMPT, prompt, {
    // Room for brief reasoning plus the JSON answer (the description isn't copied by the model).
    maxTokens: 4000,
    // Free tiers allow ~2 imports a minute; wait for the next minute rather than fail.
    maxWaitSeconds: 60,
    failMessage: "A hirdetés feldolgozása nem sikerült. Próbáld újra.",
  });
  return {
    url,
    // The description is copied from the full page text, not the shortened prompt.
    values: extractionToFormValues(r.data, { url, portalName: portal?.name ?? null }, input.text),
    missing: missingKeyFields(r.data),
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
  };
}
