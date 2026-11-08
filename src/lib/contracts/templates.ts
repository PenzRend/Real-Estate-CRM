import "server-only";
import { z } from "zod";
import { llmConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/extract";
import { structuredCall } from "@/lib/ai/structured";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/db";
import { docxText, MAX_IMPORT_CHARS, maskPersonal, pdfText, tidyMoney } from "./import-text";
import { bodyKeys, CONTRACT_KINDS, FIELD_CATALOG, isContractKind, type ContractKind, type CustomField } from "./kinds";

// The office's own wording for each contract (contract_templates). Without
// one, Flavio's built-in text is used. Owners and admins change it; the
// text can be recreated by the AI from the office's own Word or PDF contract.

export type OfficeTemplate = { kind: ContractKind; body: string; customFields: CustomField[]; sourceName: string | null; updatedAt: string };

const canManage = (user: CurrentUser) => user.organization.role !== "member";

function parseCustom(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c) => (c && typeof c.key === "string" && typeof c.label === "string" ? [{ key: c.key, label: c.label }] : []));
}

export async function listOfficeTemplates(user: CurrentUser): Promise<Partial<Record<ContractKind, OfficeTemplate>>> {
  const supabase = await db();
  const { data } = await supabase.from("contract_templates").select("kind, body, custom_fields, source_name, updated_at").eq("organization_id", user.organization.id);
  const out: Partial<Record<ContractKind, OfficeTemplate>> = {};
  for (const t of data ?? []) {
    if (isContractKind(t.kind)) out[t.kind] = { kind: t.kind, body: t.body, customFields: parseCustom(t.custom_fields), sourceName: t.source_name, updatedAt: t.updated_at };
  }
  return out;
}

export async function officeTemplate(user: CurrentUser, kind: ContractKind): Promise<OfficeTemplate | null> {
  return (await listOfficeTemplates(user))[kind] ?? null;
}

/** Keys an office text adds, with their labels (only those the text uses and no contract already knows). */
export function customFieldsOf(body: string, labels: CustomField[]): CustomField[] {
  const known = new Set(FIELD_CATALOG.map((f) => f.key));
  const byKey = new Map(labels.map((l) => [l.key, l.label.trim().slice(0, 120)]));
  return bodyKeys(body)
    .filter((k) => !known.has(k))
    .map((key) => ({ key, label: byKey.get(key) || key.replace(/_/g, " ") }));
}

export async function saveOfficeTemplate(
  user: CurrentUser,
  kind: string,
  input: { body: string; customFields: CustomField[]; sourceName: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isContractKind(kind)) return { ok: false, error: "Ismeretlen szerződéstípus." };
  if (!canManage(user)) return { ok: false, error: "A szerződések szövegét az iroda tulajdonosa vagy egy admin módosíthatja." };
  const body = input.body.replace(/\r\n?/g, "\n").trim().slice(0, 200_000);
  if (!body) return { ok: false, error: "A szöveg üres." };
  const supabase = await db();
  const row = { body, custom_fields: customFieldsOf(body, input.customFields), source_name: input.sourceName?.slice(0, 300) || null, updated_by: user.id };
  // Update, or insert the first time (an upsert would also try to update the office and kind, which nobody may change).
  const { data: updated, error: updateError } = await supabase.from("contract_templates").update(row).eq("organization_id", user.organization.id).eq("kind", kind).select("id");
  if (updateError) return { ok: false, error: "A szöveget nem sikerült menteni." };
  if (!updated?.length) {
    const { error } = await supabase.from("contract_templates").insert({ ...row, organization_id: user.organization.id, kind });
    if (error) {
      console.error("contract template insert", error.code, error.message);
      return { ok: false, error: "A szöveget nem sikerült menteni." };
    }
  }
  return { ok: true };
}

/** Back to Flavio's built-in text. */
export async function resetOfficeTemplate(user: CurrentUser, kind: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isContractKind(kind)) return { ok: false, error: "Ismeretlen szerződéstípus." };
  if (!canManage(user)) return { ok: false, error: "A szerződések szövegét az iroda tulajdonosa vagy egy admin módosíthatja." };
  const supabase = await db();
  await supabase.from("contract_templates").delete().eq("organization_id", user.organization.id).eq("kind", kind);
  return { ok: true };
}

const recreateSchema = z.object({
  body: z.string(),
  newFields: z.array(z.object({ key: z.string(), label: z.string() })),
  notes: z.array(z.string()),
});

const MONEY_WORDS = ["iranyar", "vetelar", "foglalo", "berleti_dij", "kaucio"];

function fieldList(kind: ContractKind) {
  const own = CONTRACT_KINDS[kind].fields;
  const others = FIELD_CATALOG.filter((f) => !own.some((o) => o.key === f.key));
  const line = (f: { key: string; label: string; hint?: string }) => `{${f.key}} – ${f.label}${f.hint ? ` (${f.hint})` : ""}`;
  return [
    `Fields of this contract (${CONTRACT_KINDS[kind].label}):`,
    ...own.map(line),
    "",
    "Amounts with words (\"63 500 000 Ft, azaz hatvanhárommillió-ötszázezer forint\"): " + MONEY_WORDS.map((k) => `{${k}_szoveg}`).join(", "),
    "",
    "Other known fields:",
    ...others.map(line),
  ].join("\n");
}

const SYSTEM = (kind: ContractKind) => `You turn a Hungarian real estate agency's own contract into a reusable template for its CRM.

Template language:
- "# " title line, "## " section headings, **bold**, "- " list items, blank line between paragraphs; a single line break stays a line break (signature blocks, addresses).
- {field} placeholders, filled from the CRM or by the agent on review.
- [[AI: instruction]] marks a paragraph the AI writes per case. Use it only where the original clearly has case-specific free text (e.g. "egyéb megállapodások"); otherwise never.

Rules:
1. Keep the agency's wording, clause order and numbering exactly. Do not rewrite, shorten, summarise, translate or "improve" the legal text. Fix only broken line wraps and hyphenation from the PDF/Word extraction.
2. Replace every concrete case detail and every blank (dotted lines "……", "_____", "[ ]", "...") with the matching {field}: names, birth data, mother's name, addresses, ID documents, parcel number (helyrajzi szám), area, ownership share, prices, deposit, dates, place of signing, the agency's and agent's details. Read the words right before and after each blank to pick the field: "……… helyrajzi számú" is {helyrajzi_szam}; "……… szám alatt" or "természetben ……… található" is {ingatlan_cim}.
   Amounts: {vetelar}, {foglalo}, {iranyar}, {berleti_dij}, {kaucio} already end in "Ft" ("63 500 000 Ft"); {…_szoveg} is the whole phrase "63 500 000 Ft, azaz hatvanhárommillió-ötszázezer forint". So "……… Ft, azaz ……… forint" becomes just "{vetelar_szoveg}", and "……… Ft foglalót" becomes "{foglalo} foglalót". Never write "Ft" or "forint" next to a money field.
3. Personal identifiers were already replaced with [e-mail], [telefon], [okmány], [adóazonosító], [bankszámla]: put the matching field there, or a new field.
4. When nothing in the list fits a blank, invent a field: lowercase Hungarian words without accents joined by "_", e.g. {kozos_koltseg}, {kulcsok_szama}, {gazora_allas}; list each in newFields with a short Hungarian label ("Közös költség"). Never invent a field that duplicates a listed one.
5. Repeated parties (several sellers or buyers) keep the first one's fields, and add numbered new fields for the others (e.g. {elado2_nev}).
6. notes: up to 6 short Hungarian sentences for the agency: what you turned into fields, what you could not read, anything that looks missing or outdated. Call the source "a feltöltött szerződés". No legal advice.

${fieldList(kind)}`;

const sanitizeKey = (k: string) =>
  k
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

export type RecreateResult = { ok: true; body: string; customFields: CustomField[]; notes: string[]; sourceName: string } | { ok: false; error: string };

/** The office's Word or PDF contract → a template in Flavio's language (not saved; the editor shows it for review). */
export async function recreateFromFile(user: CurrentUser, kind: string, file: File): Promise<RecreateResult> {
  if (!isContractKind(kind)) return { ok: false, error: "Ismeretlen szerződéstípus." };
  if (!canManage(user)) return { ok: false, error: "A szerződések szövegét az iroda tulajdonosa vagy egy admin módosíthatja." };
  if (!llmConfig()) return { ok: false, error: "Az AI most nem érhető el." };
  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };

  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  let text: string;
  try {
    if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") text = docxText(buf);
    else if (name.endsWith(".pdf") || file.type === "application/pdf") text = await pdfText(buf);
    else if (name.endsWith(".doc")) return { ok: false, error: "A régi .doc formátumot nem tudjuk olvasni. Mentsd el Wordben .docx-ként, és töltsd fel újra." };
    else return { ok: false, error: "Word (.docx) vagy PDF fájlt tölts fel." };
  } catch {
    return { ok: false, error: "A fájlt nem sikerült megnyitni. Ellenőrizd, hogy nem sérült vagy jelszóval védett." };
  }
  if (text.replace(/\s/g, "").length < 200) return { ok: false, error: "Ebből a fájlból nem olvasható ki szöveg – valószínűleg beszkennelt kép. Tölts fel Word-fájlt vagy szöveges PDF-et." };
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: "Ez a dokumentum túl hosszú egy szerződéssablonhoz (legfeljebb kb. 25 oldal)." };

  try {
    const r = await structuredCall(recreateSchema, SYSTEM(kind), `The agency's contract (${file.name}):\n\n${maskPersonal(text)}`, {
      maxTokens: 32_000,
      failMessage: "Az AI most nem tudta feldolgozni a szerződést. Próbáld újra.",
    });
    await logAiUsage(user, { status: "success", operation: "assistant", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    // New field names cleaned up the same way in the list and in the text.
    let body = r.data.body.replace(/\r\n?/g, "\n").trim();
    const labels: CustomField[] = [];
    for (const f of r.data.newFields) {
      const key = sanitizeKey(f.key.replace(/[{}]/g, ""));
      if (!key) continue;
      if (key !== f.key) body = body.split(`{${f.key.replace(/[{}]/g, "")}}`).join(`{${key}}`);
      labels.push({ key, label: f.label.trim() });
    }
    body = tidyMoney(body.replace(/\{([^{}\n]{1,60})\}/g, (m, k: string) => (/^[a-z0-9_]+$/.test(k) ? m : `{${sanitizeKey(k)}}`)));
    if (body.length < 100) return { ok: false, error: "Az AI válasza hiányos volt. Próbáld újra." };
    return { ok: true, body, customFields: customFieldsOf(body, labels), notes: r.data.notes.slice(0, 6), sourceName: file.name.slice(0, 300) };
  } catch (error) {
    await logAiUsage(user, { status: "error", operation: "assistant" });
    return { ok: false, error: (error instanceof AiError && error.userMessage) || "Az AI most nem tudta feldolgozni a szerződést. Próbáld újra." };
  }
}
