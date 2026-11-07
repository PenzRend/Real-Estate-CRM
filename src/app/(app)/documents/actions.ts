"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addOfficeDocument, createFolder, deleteFolder, deleteOfficeDocument, renameFolder, updateOfficeDocument } from "@/lib/office-docs/data";
import { fillTemplate } from "@/lib/office-docs/fill";

export async function addOfficeDocumentAction(d: { path: string; fileName: string; size: number; mimeType: string; folderId: string | null }) {
  const user = await getCurrentUser();
  const r = await addOfficeDocument(user, {
    path: String(d.path),
    fileName: String(d.fileName),
    size: Number(d.size) || 0,
    mimeType: String(d.mimeType ?? ""),
    folderId: d.folderId ? String(d.folderId) : null,
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
