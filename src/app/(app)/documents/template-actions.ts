"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isRefKind } from "@/lib/chat/refs";
import { listFolders } from "@/lib/office-docs/data";
import { STARTER_TEMPLATES } from "@/lib/office-docs/starter-templates";
import { toBlocks, toHtml } from "@/lib/office-docs/template-render";
import { deleteTemplate, generateDocument, listTemplates, renderTemplate, saveTemplate, type TemplateInput } from "@/lib/office-docs/templates";

export async function saveTemplateAction(id: string | null, input: TemplateInput) {
  const user = await getCurrentUser();
  const r = await saveTemplate(user, id ? String(id) : null, {
    name: String(input.name ?? ""),
    body: String(input.body ?? ""),
    trigger: String(input.trigger ?? "manual"),
    folderId: input.folderId ? String(input.folderId) : null,
    active: Boolean(input.active),
  });
  if (r.ok) refresh();
  return r;
}

export async function deleteTemplateAction(id: string) {
  const user = await getCurrentUser();
  await deleteTemplate(user, String(id));
  redirect("/documents/templates");
}

/** The editor's preview: filled with a chosen record (or empty fields); AI paragraphs only when asked. */
export async function previewTemplateAction(body: string, ref: { kind: string; id: string } | null, withAi: boolean) {
  const user = await getCurrentUser();
  const r = await renderTemplate(user, String(body ?? "").slice(0, 100_000), ref && isRefKind(ref.kind) ? { kind: ref.kind, id: String(ref.id) } : null, Boolean(withAi));
  return toHtml(toBlocks(r.text));
}

export async function generateDocumentAction(templateId: string, ref: { kind: string; id: string }) {
  const user = await getCurrentUser();
  const r = await generateDocument(user, String(templateId), { kind: String(ref?.kind), id: String(ref?.id) });
  if (r.ok) refresh();
  return r;
}

/** Templates to pick from on a client's, listing's or deal's page. */
export async function templateChoicesAction() {
  const user = await getCurrentUser();
  return (await listTemplates(user)).filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));
}

/** "Példasablonok": adds the ready-made templates the office doesn't have yet (switched off, to look at first). */
export async function addStarterTemplatesAction() {
  const user = await getCurrentUser();
  const [existing, folders] = await Promise.all([listTemplates(user), listFolders(user)]);
  let added = 0;
  for (const t of STARTER_TEMPLATES) {
    if (existing.some((e) => e.name === t.name)) continue;
    const folder = folders.find((f) => f.name === t.folder)?.id ?? null;
    const r = await saveTemplate(user, null, { name: t.name, body: t.body, trigger: t.trigger, folderId: folder, active: false });
    if (r.ok) added++;
  }
  refresh();
  return added;
}
