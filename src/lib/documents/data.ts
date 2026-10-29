import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { sendNewEmail } from "@/lib/mail/send";
import { db } from "@/lib/supabase/db";
import { askable, checklist, DOCUMENT_KINDS, documentKinds, requestEmail, type DocumentKind, type DocumentRow } from "./checklist";

// A listing's documents: files in the private "documents" bucket (uploaded by
// the browser straight into the workspace's folder), checklist marks, and
// asking the owner for what is missing.

export const DOCUMENTS_BUCKET = "documents";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_SECONDS = 3600;

export async function listDocuments(user: CurrentUser, propertyId: string): Promise<DocumentRow[]> {
  if (!UUID.test(propertyId)) return [];
  const supabase = await db();
  const { data } = await supabase
    .from("property_documents")
    .select("id, kind, storage_path, file_name, size_bytes, mark, created_at")
    .eq("property_id", propertyId)
    .eq("organization_id", user.organization.id)
    .order("created_at");
  const rows = data ?? [];
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
  const { data: links } = paths.length ? await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrls(paths, LINK_SECONDS, { download: true }) : { data: [] };
  const urlByPath = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as DocumentKind,
    fileName: r.file_name,
    url: r.storage_path ? (urlByPath.get(r.storage_path) ?? null) : null,
    mark: r.mark,
    createdAt: r.created_at,
    sizeBytes: r.size_bytes,
  }));
}

/** Records a file the browser uploaded; the path must be inside this listing's folder. */
export async function addDocument(user: CurrentUser, propertyId: string, d: { kind: string; path: string; fileName: string; size: number }) {
  if (!UUID.test(propertyId) || !(DOCUMENT_KINDS as readonly string[]).includes(d.kind)) return { ok: false as const, error: "Ismeretlen dokumentum." };
  if (!d.path.startsWith(`${user.organization.id}/${propertyId}/`) || d.path.includes("..") || d.path.length > 500) return { ok: false as const, error: "Érvénytelen fájl." };
  const supabase = await db();
  const { error } = await supabase.from("property_documents").insert({
    organization_id: user.organization.id,
    property_id: propertyId,
    kind: d.kind,
    storage_path: d.path,
    file_name: d.fileName.slice(0, 300),
    size_bytes: Math.max(0, Math.round(d.size)),
  });
  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([d.path]);
    console.error("document save failed", error.code);
    return { ok: false as const, error: "A fájlt nem sikerült menteni." };
  }
  // A file supersedes "not needed" / "requested".
  await supabase.from("property_documents").delete().eq("property_id", propertyId).eq("kind", d.kind).not("mark", "is", null);
  return { ok: true as const };
}

export async function deleteDocument(user: CurrentUser, id: string) {
  if (!UUID.test(id)) return;
  const supabase = await db();
  const { data } = await supabase.from("property_documents").select("storage_path").eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  if (!data) return;
  if (data.storage_path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([data.storage_path]);
  await supabase.from("property_documents").delete().eq("id", id).eq("organization_id", user.organization.id);
}

/** "Nem szükséges" (or back to missing) for one kind. */
export async function setDocumentMark(user: CurrentUser, propertyId: string, kind: string, mark: "not_needed" | "requested" | null) {
  if (!UUID.test(propertyId) || !(DOCUMENT_KINDS as readonly string[]).includes(kind)) return;
  const supabase = await db();
  await supabase.from("property_documents").delete().eq("property_id", propertyId).eq("organization_id", user.organization.id).eq("kind", kind).not("mark", "is", null);
  if (mark) await supabase.from("property_documents").insert({ organization_id: user.organization.id, property_id: propertyId, kind, mark });
}

/** Emails the owner (from the agent's mailbox) for the missing documents they hold, and marks them requested. */
export async function requestMissingDocuments(user: CurrentUser, propertyId: string, now: Date): Promise<{ ok: true; count: number } | { ok: false; error: string; needsPermission?: boolean }> {
  if (!UUID.test(propertyId)) return { ok: false, error: "Ismeretlen ingatlan." };
  const supabase = await db();
  const { data: p } = await supabase.from("properties").select("title, owner_client_id").eq("id", propertyId).eq("organization_id", user.organization.id).maybeSingle();
  if (!p?.owner_client_id) return { ok: false, error: "Előbb add meg a tulajdonost (Szerkesztés → Tulajdonos)." };
  const { data: owner } = await supabase.from("clients").select("full_name, email").eq("id", p.owner_client_id).maybeSingle();
  if (!owner?.email) return { ok: false, error: "A tulajdonosnak nincs e-mail-címe a Flavióban." };
  const missing = askable(checklist(await listDocuments(user, propertyId)));
  if (!missing.length) return { ok: false, error: "Nincs olyan hiányzó dokumentum, amit a tulajdonostól kell kérni." };
  const { subject, body } = requestEmail({
    ownerName: owner.full_name,
    propertyTitle: p.title,
    missing: missing.map((m) => ({ label: m.label, hint: documentKinds[m.kind].hint, required: m.required })),
    agentName: user.fullName ?? "Az ingatlanosa",
  });
  const sent = await sendNewEmail(
    user,
    { to: owner.email, subject, body, clientId: p.owner_client_id, propertyId, followUpDays: 3, taskTitle: `Dokumentumok bekérése: ${p.title}` },
    now,
  );
  if (!sent.ok) return sent;
  for (const m of missing) await setDocumentMark(user, propertyId, m.kind, "requested");
  return { ok: true, count: missing.length };
}
