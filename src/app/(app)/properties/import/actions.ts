"use server";

import { z } from "zod";
import { AiError } from "@/lib/ai/extract";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { fetchListingPage } from "@/lib/listings/fetch-page";
import { videoLinks } from "@/lib/listings/html";
import { extractListing, findImported, type ImportedRef } from "@/lib/listings/import";
import { canonicalListingUrl, looksLikeListingText, portalOf } from "@/lib/listings/source";

const extractSchema = z.object({
  url: z.string().max(2000),
  /** Page text from the extension or a paste; empty means "open the link". */
  text: z.string().max(60_000).optional(),
  structured: z.string().max(20_000).nullable().optional(),
  images: z.array(z.string().max(2000)).max(60).optional(),
  videos: z.array(z.string().max(2000)).max(20).optional(),
});

export type ExtractResult =
  | {
      ok: true;
      url: string;
      values: Record<string, string>;
      missing: string[];
      images: string[];
      videos: string[];
      /** Where the photos can be downloaded from: the CRM server, or the extension already did. */
      imageSource: "server" | "extension";
    }
  | {
      ok: false;
      error: string;
      duplicate?: ImportedRef & { url: string };
      /** The portal doesn't serve pages to servers: read it in the browser (extension) or paste. */
      blocked?: { portal: string };
    };

export async function extractListingAction(input: unknown): Promise<ExtractResult> {
  const user = await getCurrentUser();
  const parsed = extractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "A hirdetés túl hosszú vagy hiányos." };
  const url = canonicalListingUrl(parsed.data.url);
  if (!url) return { ok: false, error: "Adj meg egy érvényes hirdetési linket (https://…)." };

  const existing = (await findImported(user, [url]))[url];
  if (existing) return { ok: false, error: "Ezt a hirdetést már importáltad.", duplicate: { ...existing, url } };

  let text = parsed.data.text?.trim() ?? "";
  let structured = parsed.data.structured ?? null;
  let images = parsed.data.images ?? [];
  let videos = videoLinks(parsed.data.videos ?? []);
  let imageSource: "server" | "extension" = images.length ? "extension" : "server";

  if (!text) {
    const portal = portalOf(new URL(url));
    const page = await fetchListingPage(url);
    if (!page.ok) {
      if (page.reason === "not_portal") return { ok: false, error: "Ezt az oldalt nem tudom megnyitni. Illeszd be a hirdetés szövegét, vagy használd a bővítményt." };
      return {
        ok: false,
        error:
          page.reason === "failed"
            ? "A hirdetést most nem sikerült megnyitni. Próbáld újra, vagy használd a bővítményt."
            : `A(z) ${portal?.name ?? "portál"} nem engedi, hogy a CRM szervere megnyissa a hirdetést. A böngésződben, a bővítménnyel egy kattintás.`,
        blocked: { portal: portal?.name ?? "portál" },
      };
    }
    ({ text, structured, images, videos } = page);
    imageSource = "server";
  }
  if (!looksLikeListingText(text)) return { ok: false, error: "A hirdetés oldalán nem találtam elég szöveget. Biztosan a hirdetés linkje?" };

  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };
  try {
    const draft = await extractListing({ url, text, structured });
    // Logged as an extraction (the schema's existing operation type); metadata only.
    await logAiUsage(user, { status: "success", operation: "extract_interaction", model: draft.model, inputTokens: draft.inputTokens, outputTokens: draft.outputTokens });
    return { ok: true, url: draft.url, values: { ...draft.values, video_links: JSON.stringify(videos) }, missing: draft.missing, images, videos, imageSource };
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error", operation: "extract_interaction" });
      console.error("listing import", error.message);
      return { ok: false, error: error.userMessage };
    }
    throw error;
  }
}

/** For the extension's profile list: which listings are already in the CRM. */
export async function checkImportedAction(urls: unknown): Promise<Record<string, ImportedRef>> {
  const user = await getCurrentUser();
  const list = z.array(z.string().max(2000)).max(200).safeParse(urls);
  return list.success ? findImported(user, list.data) : {};
}
