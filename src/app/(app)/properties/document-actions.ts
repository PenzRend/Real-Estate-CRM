"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addDocument, deleteDocument, requestMissingDocuments, setDocumentMark } from "@/lib/documents/data";

export async function addDocumentAction(propertyId: string, d: { kind: string; path: string; fileName: string; size: number }) {
  const user = await getCurrentUser();
  const r = await addDocument(user, propertyId, { kind: String(d.kind), path: String(d.path), fileName: String(d.fileName), size: Number(d.size) || 0 });
  if (r.ok) refresh();
  return r;
}

export async function deleteDocumentAction(id: string) {
  const user = await getCurrentUser();
  await deleteDocument(user, id);
  refresh();
}

export async function setDocumentMarkAction(propertyId: string, kind: string, mark: "not_needed" | null) {
  const user = await getCurrentUser();
  await setDocumentMark(user, propertyId, kind, mark === "not_needed" ? "not_needed" : null);
  refresh();
}

export async function requestDocumentsAction(propertyId: string) {
  const user = await getCurrentUser();
  const r = await requestMissingDocuments(user, propertyId, new Date());
  if (r.ok) refresh();
  return r;
}
