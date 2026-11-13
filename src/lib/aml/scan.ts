import "server-only";
import { AiError, postWithRetry, readJson } from "@/lib/ai/extract";
import { cleanScan, type ScanKind, type ScannedFields } from "./scan-fields";

// Reads an ID card, passport or driving licence (front and back) or an
// address card from photos, for the identification form. The photos go only
// to the main AI provider (Groq: no training on customer data), never to the
// fallback, and are not stored: read, fields returned, discarded.

/** The vision model on the main provider. AI_VISION_* overrides it. */
function visionConfig() {
  const baseUrl = (process.env.AI_VISION_BASE_URL || process.env.AI_BASE_URL)?.replace(/\/$/, "");
  const apiKey = process.env.AI_VISION_API_KEY || process.env.AI_API_KEY;
  const model = process.env.AI_VISION_MODEL || "qwen/qwen3.8-27b";
  return baseUrl && apiKey ? { baseUrl, apiKey, model } : null;
}

export const visionAvailable = () => visionConfig() != null;

const PROMPTS: Record<ScanKind, string> = {
  identity: `The photos show a Hungarian (or other European) identity document: a personal ID card (személyazonosító igazolvány, front and/or back), a passport, or a card driving licence. Read it and return JSON with exactly these keys (use "" for anything not visible; never guess):
- full_name: the holder's family and given names as printed (Hungarian order: family name first)
- birth_name: birth name ("Születési név") if printed and different
- mother_name: mother's birth name ("Anyja neve" / "Anyja születési neve")
- birth_place: place of birth
- birth_date: date of birth, YYYY-MM-DD
- nationality: as printed (e.g. HUN)
- document_type: "id_card", "passport" or "driving_licence"
- document_number: the document's own number (okmányazonosító / document no.), NOT the personal identification number (személyi azonosító) and NOT the CAN
- document_expires_on: expiry date, YYYY-MM-DD
Do not return the personal identification number, the tax number or any other number.`,
  address: `The photos show a Hungarian address card (lakcímet igazoló hatósági igazolvány, "lakcímkártya"), front and/or back. Return JSON with exactly these keys (use "" for anything not visible; never guess):
- address: the registered address (lakóhely) in one line: postcode, settlement, street and number, e.g. "1133 Budapest, Váci út 1. 2/3."
- address_card_number: the card's own number printed on it (e.g. 123456AB)
Do not return the personal identification number (személyi azonosító) or anything else.`,
};

export async function readIdDocument(kind: ScanKind, images: string[]): Promise<{ fields: ScannedFields; model: string; inputTokens: number; outputTokens: number }> {
  const config = visionConfig();
  if (!config) throw new AiError("no vision model", "Az okmány beolvasása most nem érhető el. Töltsd ki kézzel.");
  const res = await postWithRetry(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: [{ type: "text", text: PROMPTS[kind] }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] }],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    },
    10,
    45_000,
  );
  if (!res.ok) {
    console.error("id scan", res.status, (await res.text()).slice(0, 300));
    throw new AiError(`vision ${res.status}`, "Az okmányt most nem sikerült beolvasni. Próbáld újra, vagy töltsd ki kézzel.");
  }
  const body = (await readJson(res)) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: { message?: { content?: string } }[] };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "null");
  } catch {
    throw new AiError("vision json", "Az okmányt nem sikerült beolvasni. Készíts élesebb, egyenes fotót, vagy töltsd ki kézzel.");
  }
  return { fields: cleanScan(kind, parsed), model: body.model ?? config.model, inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 };
}
