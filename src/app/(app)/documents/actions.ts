"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { llmConfig } from "@/lib/ai/config";
import { structuredCall } from "@/lib/ai/structured";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { addOfficeDocument, createFolder, deleteFolder, deleteOfficeDocument, listFolders, renameFolder, updateOfficeDocument } from "@/lib/office-docs/data";
import { suggestFolder } from "@/lib/office-docs/suggest";
import { fillTemplate } from "@/lib/office-docs/fill";

export async function addOfficeDocumentAction(d: { path: string; fileName: string; size: number; mimeType: string; folderId: string | null; title?: string }) {
  const user = await getCurrentUser();
  const r = await addOfficeDocument(user, {
    path: String(d.path),
    fileName: String(d.fileName),
    size: Number(d.size) || 0,
    mimeType: String(d.mimeType ?? ""),
    folderId: d.folderId ? String(d.folderId) : null,
    title: d.title == null ? undefined : String(d.title),
  });
  if (r.ok) refresh();
  return r;
}

export async function updateOfficeDocumentAction(id: string, patch: { title?: string; folderId?: string; pinned?: boolean }) {
  const user = await getCurrentUser();
  await updateOfficeDocument(user, String(id), {
    title: patch.title == null ? undefined : String(patch.title),
    folderId: patch.folderId == null ? undefined : String(patch.folderId),
    pinned: patch.pinned == null ? undefined : Boolean(patch.pinned),
  });
  refresh();
}

export async function deleteOfficeDocumentAction(id: string) {
  const user = await getCurrentUser();
  await deleteOfficeDocument(user, String(id));
  refresh();
}

/** A Word template filled from a deal, client or listing; the browser downloads the result. */
export async function fillTemplateAction(documentId: string, choice: { clientId?: string | null; propertyId?: string | null; dealId?: string | null }) {
  const user = await getCurrentUser();
  return fillTemplate(user, String(documentId), {
    clientId: choice.clientId ? String(choice.clientId) : null,
    propertyId: choice.propertyId ? String(choice.propertyId) : null,
    dealId: choice.dealId ? String(choice.dealId) : null,
  });
}

export async function createFolderAction(name: string) {
  const user = await getCurrentUser();
  const r = await createFolder(user, String(name ?? ""));
  if (r.ok) refresh();
  return r;
}

export async function renameFolderAction(id: string, name: string) {
  const user = await getCurrentUser();
  const r = await renameFolder(user, String(id), String(name ?? ""));
  if (r.ok) refresh();
  return r;
}

export async function deleteFolderAction(id: string) {
  const user = await getCurrentUser();
  const r = await deleteFolder(user, String(id));
  if (r.ok) refresh();
  return r;
}

const suggestionSchema = z.object({ choices: z.array(z.object({ file: z.string(), folder_id: z.string().nullable() })) });

/**
 * Where each file to upload probably belongs: the AI reads the names against
 * the office's folders; without AI (or when it fails), a word match does.
 */
export async function suggestFoldersAction(fileNames: string[]): Promise<Record<string, string | null>> {
  const user = await getCurrentUser();
  const names = fileNames.slice(0, 20).map((n) => String(n).slice(0, 200));
  const folders = await listFolders(user);
  const fallback = Object.fromEntries(names.map((n) => [n, suggestFolder(n, folders)]));
  if (!folders.length || !llmConfig() || (await aiLimitMessage(user))) return fallback;
  try {
    const r = await structuredCall(
      suggestionSchema,
      "You file documents for a Hungarian real estate office. For each file name, choose the folder it most likely belongs in, by its id, or null when none fits. Answer only with the given ids.",
      `Folders:\n${folders.map((f) => `${f.id}: ${f.name}`).join("\n")}\n\nFiles:\n${names.join("\n")}`,
      { maxTokens: 800, failMessage: "" },
    );
    await logAiUsage(user, { status: "success", operation: "assistant", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    const valid = new Set(folders.map((f) => f.id));
    return Object.fromEntries(names.map((n) => [n, ((id) => (id && valid.has(id) ? id : fallback[n]))(r.data.choices.find((c) => c.file === n)?.folder_id ?? null)]));
  } catch {
    return fallback;
  }
}
