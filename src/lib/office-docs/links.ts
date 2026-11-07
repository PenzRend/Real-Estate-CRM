import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { isRefKind, refKey, resolveRefs, type RefCard, type RefKind } from "@/lib/chat/refs";
import { DOCUMENTS_BUCKET } from "@/lib/documents/data";
import { createClient } from "@/lib/supabase/server";

// Which clients, listings and deals a file in Dokumentumok belongs to. Set by
// hand, suggested by the AI on upload, or by the template that wrote it.

export type DocLink = RefCard & { linkId: string; source: "manual" | "ai" | "template" };
export type LinkedFile = { id: string; title: string; fileName: string; createdAt: string; url: string | null; source: DocLink["source"] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_SECONDS = 3600;

/** The links of the given files, as cards of the records they point at. */
export async function linksOf(user: CurrentUser, documentIds: string[]): Promise<Map<string, DocLink[]>> {
  const out = new Map<string, DocLink[]>();
  if (!documentIds.length) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("office_document_links")
    .select("id, document_id, record_kind, record_id, source")
    .eq("organization_id", user.organization.id)
    .in("document_id", documentIds);
  const rows = (data ?? []).filter((r) => isRefKind(r.record_kind));
  const cards = await resolveRefs(
    user,
    rows.map((r) => ({ kind: r.record_kind as RefKind, id: r.record_id })),
  );
  for (const r of rows) {
    const card = cards.get(refKey(r.record_kind, r.record_id));
    if (!card) continue; // the record is gone or not visible
    out.set(r.document_id, [...(out.get(r.document_id) ?? []), { ...card, linkId: r.id, source: r.source }]);
  }
  return out;
}

export async function linkDocument(user: CurrentUser, documentId: string, kind: string, recordId: string, source: DocLink["source"] = "manual") {
  if (!UUID.test(documentId) || !UUID.test(recordId) || !isRefKind(kind)) return { ok: false as const, error: "Ismeretlen rekord." };
  // Only what this workspace has can be linked.
  if (!(await resolveRefs(user, [{ kind, id: recordId }])).size) return { ok: false as const, error: "Ez a rekord nem található." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("office_document_links")
    .upsert({ organization_id: user.organization.id, document_id: documentId, record_kind: kind, record_id: recordId, source }, { onConflict: "document_id,record_kind,record_id", ignoreDuplicates: true });
  if (error) return { ok: false as const, error: "A kapcsolást nem sikerült menteni." };
  return { ok: true as const };
}

export async function unlinkDocument(user: CurrentUser, linkId: string) {
  if (!UUID.test(linkId)) return;
  const supabase = await createClient();
  await supabase.from("office_document_links").delete().eq("id", linkId).eq("organization_id", user.organization.id);
}

/** The files linked to one client, listing or deal, newest first, with download links. */
export async function filesFor(user: CurrentUser, kind: RefKind, recordId: string): Promise<LinkedFile[]> {
  if (!UUID.test(recordId)) return [];
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("office_document_links")
    .select("document_id, source")
    .eq("organization_id", user.organization.id)
    .eq("record_kind", kind)
    .eq("record_id", recordId);
  const ids = (links ?? []).map((l) => l.document_id);
  if (!ids.length) return [];
  const { data: docs } = await supabase
    .from("office_documents")
    .select("id, title, file_name, created_at, storage_path")
    .eq("organization_id", user.organization.id)
    .in("id", ids)
    .order("created_at", { ascending: false });
  const rows = docs ?? [];
  const { data: urls } = rows.length ? await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrls(rows.map((d) => d.storage_path), LINK_SECONDS, { download: true }) : { data: [] };
  const url = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
  const source = new Map((links ?? []).map((l) => [l.document_id, l.source as DocLink["source"]]));
  return rows.map((d) => ({ id: d.id, title: d.title, fileName: d.file_name, createdAt: d.created_at, url: url.get(d.storage_path) ?? null, source: source.get(d.id) ?? "manual" }));
}
