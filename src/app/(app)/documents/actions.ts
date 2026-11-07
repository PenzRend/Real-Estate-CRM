"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addOfficeDocument, deleteOfficeDocument, updateOfficeDocument } from "@/lib/office-docs/data";
import { fillTemplate } from "@/lib/office-docs/fill";

export async function addOfficeDocumentAction(d: { path: string; fileName: string; size: number; mimeType: string; folder: string }) {
  const user = await getCurrentUser();
  const r = await addOfficeDocument(user, {
    path: String(d.path),
    fileName: String(d.fileName),
    size: Number(d.size) || 0,
    mimeType: String(d.mimeType ?? ""),
    folder: String(d.folder),
  });
  if (r.ok) refresh();
  return r;
}

export async function updateOfficeDocumentAction(id: string, patch: { title?: string; folder?: string; pinned?: boolean }) {
  const user = await getCurrentUser();
  await updateOfficeDocument(user, String(id), {
    title: patch.title == null ? undefined : String(patch.title),
    folder: patch.folder == null ? undefined : String(patch.folder),
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
