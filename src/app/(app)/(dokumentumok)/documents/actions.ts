"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { llmConfig } from "@/lib/ai/config";
import { structuredCall } from "@/lib/ai/structured";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { addOfficeDocument, createFolder, deleteFolder, deleteOfficeDocument, listFolders, renameFolder, updateOfficeDocument } from "@/lib/office-docs/data";
import { linkDocument, unlinkDocument } from "@/lib/office-docs/links";
import { suggestFolder } from "@/lib/office-docs/suggest";
import { globalSearch } from "@/lib/search/global";
import { fillTemplate } from "@/lib/office-docs/fill";

export async function addOfficeDocumentAction(d: {
  path: string;
  fileName: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  title?: string;
  links?: { kind: string; id: string; source: "manual" | "ai" }[];
}) {
  const user = await getCurrentUser();
  const r = await addOfficeDocument(user, {
    path: String(d.path),
    fileName: String(d.fileName),
    size: Number(d.size) || 0,
    mimeType: String(d.mimeType ?? ""),
    folderId: d.folderId ? String(d.folderId) : null,
    title: d.title == null ? undefined : String(d.title),
  });
  if (r.ok) for (const l of (d.links ?? []).slice(0, 10)) await linkDocument(user, r.id, String(l.kind), String(l.id), l.source === "ai" ? "ai" : "manual");
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

export async function linkDocumentAction(documentId: string, ref: { kind: string; id: string }) {
  const user = await getCurrentUser();
  const r = await linkDocument(user, String(documentId), String(ref?.kind), String(ref?.id));
  if (r.ok) refresh();
  return r;
}

export async function unlinkDocumentAction(linkId: string) {
  const user = await getCurrentUser();
  await unlinkDocument(user, String(linkId));
  refresh();
}

export type LinkSuggestion = { kind: "client" | "property" | "deal"; id: string; title: string; detail: string | null };

const linkChoiceSchema = z.object({ choices: z.array(z.object({ file: z.string(), records: z.array(z.string()) })) });

/**
 * Which clients, listings or deals each file to upload is about: names in
 * the file name are looked up, then the AI keeps the ones the file really
 * concerns (without AI, only records whose whole name is in the file name).
 */
export async function suggestLinksAction(fileNames: string[]): Promise<Record<string, LinkSuggestion[]>> {
  const user = await getCurrentUser();
  const kinds = { clients: "client", properties: "property", deals: "deal" } as const;
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const out: Record<string, LinkSuggestion[]> = {};
  const candidates: Record<string, LinkSuggestion[]> = {};
  for (const name of fileNames.slice(0, 10).map((n) => String(n).slice(0, 200))) {
    const words = name
      .replace(/\.[a-z0-9]{1,5}$/i, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
      .slice(0, 5);
    const seen = new Map<string, LinkSuggestion>();
    for (const q of [words.join(" "), ...words]) {
      if (q.length < 3) continue;
      for (const h of await globalSearch(user, q)) {
        if (!(h.group in kinds)) continue;
        const kind = kinds[h.group as keyof typeof kinds];
        seen.set(`${kind}:${h.id}`, { kind, id: h.id, title: h.title, detail: h.detail });
      }
      if (seen.size >= 12) break;
    }
    candidates[name] = [...seen.values()].slice(0, 12);
    // Without AI: a record counts when every word of its name is in the file name.
    const file = fold(name);
    out[name] = candidates[name].filter((c) => fold(c.title).split(/[^a-z0-9]+/).filter((w) => w.length >= 3).every((w) => file.includes(w))).slice(0, 3);
  }
  const any = Object.values(candidates).some((c) => c.length);
  if (!any || !llmConfig() || (await aiLimitMessage(user))) return out;
  try {
    const r = await structuredCall(
      linkChoiceSchema,
      "You file documents for a Hungarian real estate office. For each file name, pick which of its candidate records (clients, listings, deals) the file is about, by key, only when the name clearly refers to them. An empty list is fine.",
      Object.entries(candidates)
        .map(([file, cs]) => `File: ${file}\n${cs.map((c) => `  ${c.kind}:${c.id} = ${c.title}${c.detail ? ` (${c.detail})` : ""}`).join("\n") || "  (no candidates)"}`)
        .join("\n\n"),
      { maxTokens: 800, failMessage: "" },
    );
    await logAiUsage(user, { status: "success", operation: "assistant", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    for (const c of r.data.choices) {
      if (!candidates[c.file]) continue;
      const keys = new Set(c.records);
      out[c.file] = candidates[c.file].filter((x) => keys.has(`${x.kind}:${x.id}`)).slice(0, 4);
    }
  } catch {
    // keep the plain matches
  }
  return out;
}
