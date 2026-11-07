import "server-only";
import { z } from "zod";
import { llmConfig } from "@/lib/ai/config";
import { structuredCall } from "@/lib/ai/structured";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import type { CurrentUser } from "@/lib/auth";
import { isRefKind, type RefKind } from "@/lib/chat/refs";
import { DOCUMENTS_BUCKET } from "@/lib/documents/data";
import { createClient } from "@/lib/supabase/server";
import { templateValues } from "./fields";
import { loadRecords, type FillChoice } from "./fill";
import { linkDocument } from "./links";
import { aiInstructions, fillTemplateText, toBlocks, toDocx } from "./template-render";

// The document creator: the office's templates (template-render.ts explains
// the language) and making a document from one for a client, listing or
// deal – by hand, or by itself when a client is added or a deal starts. The
// result is a Word file in Dokumentumok, in the template's folder, linked to
// the record (and for a deal, to its buyer and listing too).

export type Trigger = "manual" | "client_created" | "deal_created";
export const triggerLabels: Record<Trigger, string> = {
  manual: "Csak kézzel",
  client_created: "Új ügyfélnél magától",
  deal_created: "Új ügyletnél magától",
};
export type DocumentTemplate = { id: string; name: string; body: string; trigger: Trigger; folderId: string | null; active: boolean; canEdit: boolean; updatedAt: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isTrigger = (t: unknown): t is Trigger => t === "manual" || t === "client_created" || t === "deal_created";

export async function listTemplates(user: CurrentUser): Promise<DocumentTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_templates")
    .select("id, name, body, trigger, folder_id, active, created_by, updated_at")
    .eq("organization_id", user.organization.id)
    .order("name");
  const manager = user.organization.role !== "member";
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    body: t.body,
    trigger: isTrigger(t.trigger) ? t.trigger : "manual",
    folderId: t.folder_id,
    active: t.active,
    canEdit: manager || t.created_by === user.id,
    updatedAt: t.updated_at,
  }));
}

export async function getTemplate(user: CurrentUser, id: string) {
  if (!UUID.test(id)) return null;
  return (await listTemplates(user)).find((t) => t.id === id) ?? null;
}

export type TemplateInput = { name: string; body: string; trigger: string; folderId: string | null; active: boolean };

export async function saveTemplate(user: CurrentUser, id: string | null, input: TemplateInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Adj nevet a sablonnak." };
  const row = {
    name,
    body: input.body.slice(0, 100_000),
    trigger: isTrigger(input.trigger) ? input.trigger : "manual",
    folder_id: input.folderId && UUID.test(input.folderId) ? input.folderId : null,
    active: Boolean(input.active),
  };
  const supabase = await createClient();
  if (id) {
    if (!UUID.test(id)) return { ok: false, error: "Ismeretlen sablon." };
    const { data, error } = await supabase.from("document_templates").update(row).eq("id", id).eq("organization_id", user.organization.id).select("id");
    if (error || !data?.length) return { ok: false, error: "Ezt a sablont a létrehozója vagy egy admin módosíthatja." };
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("document_templates").insert({ ...row, organization_id: user.organization.id }).select("id").single();
  if (error || !data) return { ok: false, error: "A sablont nem sikerült menteni." };
  return { ok: true, id: data.id };
}

export async function deleteTemplate(user: CurrentUser, id: string) {
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("document_templates").delete().eq("id", id).eq("organization_id", user.organization.id);
}

const aiSchema = z.object({ paragraphs: z.array(z.string()) });

/** The [[AI: …]] paragraphs, written from the record's facts only. Null without AI (placeholders stay). */
export async function writeAiParagraphs(user: CurrentUser, instructions: string[], facts: Record<string, string>): Promise<string[] | null> {
  if (!instructions.length || !llmConfig() || (await aiLimitMessage(user))) return null;
  try {
    const r = await structuredCall(
      aiSchema,
      "You write parts of documents for a Hungarian real estate agent. Write in Hungarian, in a warm, professional tone. Use only the facts given; never invent prices, dates, names, sizes or promises. When a fact is missing, write around it. Each paragraph sits inside a longer document that already has its greeting and sign-off: write only what the instruction asks, with no salutation (such as 'Kedves …'), no closing and no signature. Return one paragraph per instruction, in order, as plain text (no Markdown).",
      `Facts (empty means unknown):\n${JSON.stringify(facts, null, 1)}\n\nInstructions:\n${instructions.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
      { maxTokens: 2000, failMessage: "" },
    );
    await logAiUsage(user, { status: "success", operation: "assistant", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    return r.data.paragraphs;
  } catch {
    return null;
  }
}

/** The filled text of a template for a record (also the editor's "Kipróbálás" preview). */
export async function renderTemplate(user: CurrentUser, body: string, ref: { kind: RefKind; id: string } | null, withAi: boolean) {
  const choice: FillChoice = ref ? { clientId: ref.kind === "client" ? ref.id : null, propertyId: ref.kind === "property" ? ref.id : null, dealId: ref.kind === "deal" ? ref.id : null } : {};
  const records = ref
    ? await loadRecords(user, choice)
    : { buyer: null, seller: null, property: null, deal: null, agent: { name: user.fullName ?? user.email, email: user.email }, office: user.organization.name, today: new Date().toISOString().slice(0, 10) };
  const values = templateValues(records);
  const ai = withAi ? await writeAiParagraphs(user, aiInstructions(body), values) : null;
  return { text: fillTemplateText(body, values, ai ?? undefined), who: records.buyer?.full_name ?? records.property?.title ?? null, records };
}

const safeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 100) || "dokumentum";

/** Makes the document from a template for a record, saves it in Dokumentumok and links it. */
export async function generateDocument(user: CurrentUser, templateId: string, ref: { kind: string; id: string }): Promise<{ ok: true; documentId: string; title: string } | { ok: false; error: string }> {
  if (!isRefKind(ref.kind) || !UUID.test(ref.id)) return { ok: false, error: "Válassz ügyfelet, ingatlant vagy ügyletet." };
  const template = await getTemplate(user, templateId);
  if (!template) return { ok: false, error: "Ismeretlen sablon." };
  const r = await renderTemplate(user, template.body, { kind: ref.kind, id: ref.id }, true);
  const docx = toDocx(toBlocks(r.text));
  const title = `${template.name}${r.who ? ` – ${r.who}` : ""}`.slice(0, 200);
  const fileName = `${title.replace(/[\\/:*?"<>|]+/g, " ")}.docx`;
  const path = `${user.organization.id}/office/${crypto.randomUUID()}-${safeName(title)}.docx`;
  const supabase = await createClient();
  const up = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, docx, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
  if (up.error) return { ok: false, error: "A dokumentumot nem sikerült elmenteni." };
  const { data: doc, error } = await supabase
    .from("office_documents")
    .insert({
      organization_id: user.organization.id,
      folder_id: template.folderId,
      title,
      storage_path: path,
      file_name: fileName,
      size_bytes: docx.length,
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      template_id: template.id,
    })
    .select("id")
    .single();
  if (error || !doc) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return { ok: false, error: "A dokumentumot nem sikerült elmenteni." };
  }
  await linkDocument(user, doc.id, ref.kind, ref.id, "template");
  if (ref.kind === "deal") {
    // A deal's document also belongs to its buyer and listing.
    const { data: deal } = await supabase.from("deals").select("buyer_client_id, property_id").eq("id", ref.id).eq("organization_id", user.organization.id).maybeSingle();
    if (deal?.buyer_client_id) await linkDocument(user, doc.id, "client", deal.buyer_client_id, "template");
    if (deal?.property_id) await linkDocument(user, doc.id, "property", deal.property_id, "template");
  }
  return { ok: true, documentId: doc.id, title };
}

/** The templates that run by themselves on this event; each failure is logged, never thrown. */
export async function runAutomaticTemplates(user: CurrentUser, trigger: Exclude<Trigger, "manual">, ref: { kind: RefKind; id: string }) {
  const templates = (await listTemplates(user)).filter((t) => t.active && t.trigger === trigger);
  for (const t of templates) {
    const r = await generateDocument(user, t.id, ref).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : "error" }));
    if (!r.ok) console.error("automatic template failed", t.id, r.error);
  }
}
