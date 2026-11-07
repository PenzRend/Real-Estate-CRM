import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/documents/data";
import { createClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/team";
import { linksOf, type DocLink } from "./links";

// Dokumentumok: the office's shared files in the private "documents" bucket,
// under "<workspace>/office/". The browser uploads straight into that folder;
// here they are listed with short-lived download links, renamed, pinned,
// moved between the office's own folders and removed (uploader or manager;
// RLS checks it too). A file without a folder shows under "Egyéb".

export type OfficeFolder = { id: string; name: string; canEdit: boolean };

export type OfficeDocument = {
  id: string;
  title: string;
  fileName: string;
  /** Null: no folder ("Egyéb"). */
  folderId: string | null;
  sizeBytes: number;
  mimeType: string | null;
  pinned: boolean;
  createdAt: string;
  uploader: string | null;
  url: string | null;
  canEdit: boolean;
  /** The clients, listings and deals it belongs to. */
  links: DocLink[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_SECONDS = 3600;

export async function listFolders(user: CurrentUser): Promise<OfficeFolder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("office_document_folders")
    .select("id, name, created_by")
    .eq("organization_id", user.organization.id)
    .order("position")
    .order("created_at");
  const manager = user.organization.role !== "member";
  return (data ?? []).map((f) => ({ id: f.id, name: f.name, canEdit: manager || f.created_by === user.id }));
}

const folderName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, 60);

export async function createFolder(user: CurrentUser, name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const n = folderName(name);
  if (!n) return { ok: false, error: "Adj nevet a mappának." };
  if (["egyéb", "mind"].includes(n.toLowerCase())) return { ok: false, error: "Ez a név foglalt." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("office_document_folders").insert({ organization_id: user.organization.id, name: n }).select("id").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "Már van ilyen nevű mappa." : "A mappát nem sikerült létrehozni." };
  return { ok: true, id: data.id };
}

export async function renameFolder(user: CurrentUser, id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = folderName(name);
  if (!UUID.test(id) || !n) return { ok: false, error: "Adj nevet a mappának." };
  if (["egyéb", "mind"].includes(n.toLowerCase())) return { ok: false, error: "Ez a név foglalt." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("office_document_folders").update({ name: n }).eq("id", id).eq("organization_id", user.organization.id).select("id");
  if (error) return { ok: false, error: error.code === "23505" ? "Már van ilyen nevű mappa." : "Az átnevezés nem sikerült." };
  if (!data?.length) return { ok: false, error: "Ezt a mappát a létrehozója vagy egy admin nevezheti át." };
  return { ok: true };
}

/** The folder goes; its files stay, without a folder. */
export async function deleteFolder(user: CurrentUser, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Ismeretlen mappa." };
  const supabase = await createClient();
  const { data } = await supabase.from("office_document_folders").delete().eq("id", id).eq("organization_id", user.organization.id).select("id");
  if (!data?.length) return { ok: false, error: "Ezt a mappát a létrehozója vagy egy admin törölheti." };
  return { ok: true };
}

export async function listOfficeDocuments(user: CurrentUser): Promise<OfficeDocument[]> {
  const supabase = await createClient();
  const [{ data }, { members }] = await Promise.all([
    supabase
      .from("office_documents")
      .select("id, title, file_name, folder_id, size_bytes, mime_type, pinned, created_at, created_by, storage_path")
      .eq("organization_id", user.organization.id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    listTeam(user),
  ]);
  const rows = data ?? [];
  const { data: links } = rows.length
    ? await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrls(
        rows.map((r) => r.storage_path),
        LINK_SECONDS,
        { download: true },
      )
    : { data: [] };
  const url = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));
  const names = new Map(members.map((m) => [m.userId, m.name]));
  const manager = user.organization.role !== "member";
  const linked = await linksOf(
    user,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    fileName: r.file_name,
    folderId: r.folder_id,
    sizeBytes: Number(r.size_bytes),
    mimeType: r.mime_type,
    pinned: r.pinned,
    createdAt: r.created_at,
    uploader: r.created_by ? (names.get(r.created_by) ?? null) : null,
    url: url.get(r.storage_path) ?? null,
    canEdit: manager || r.created_by === user.id,
    links: linked.get(r.id) ?? [],
  }));
}

/** Records a file the browser uploaded into the workspace's office folder. */
export async function addOfficeDocument(user: CurrentUser, d: { path: string; fileName: string; size: number; mimeType: string; folderId: string | null; title?: string }) {
  if (!d.path.startsWith(`${user.organization.id}/office/`) || d.path.includes("..") || d.path.length > 500) return { ok: false as const, error: "Érvénytelen fájl." };
  const supabase = await createClient();
  const title = d.title?.trim().slice(0, 200) || d.fileName.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Dokumentum";
  const { data: inserted, error } = await supabase.from("office_documents").insert({
    organization_id: user.organization.id,
    folder_id: d.folderId && UUID.test(d.folderId) ? d.folderId : null,
    title,
    storage_path: d.path,
    file_name: d.fileName.slice(0, 300),
    size_bytes: Math.max(0, Math.round(d.size)),
    mime_type: d.mimeType.slice(0, 200) || null,
  }).select("id").single();
  if (error || !inserted) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([d.path]);
    console.error("office document save failed", error?.code);
    return { ok: false as const, error: "A fájlt nem sikerült menteni." };
  }
  return { ok: true as const, id: inserted.id as string };
}

/** `folderId`: a folder, or "" for none ("Egyéb"). */
export async function updateOfficeDocument(user: CurrentUser, id: string, patch: { title?: string; folderId?: string; pinned?: boolean }) {
  if (!UUID.test(id)) return;
  const update: Record<string, unknown> = {};
  if (patch.title != null && patch.title.trim()) update.title = patch.title.trim().slice(0, 200);
  if (patch.folderId != null) update.folder_id = UUID.test(patch.folderId) ? patch.folderId : null;
  if (patch.pinned != null) update.pinned = patch.pinned;
  if (!Object.keys(update).length) return;
  const supabase = await createClient();
  await supabase.from("office_documents").update(update).eq("id", id).eq("organization_id", user.organization.id);
}

export async function deleteOfficeDocument(user: CurrentUser, id: string) {
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  // RLS lets only the uploader or a manager delete: remove the file only once the row is gone.
  const { data } = await supabase.from("office_documents").delete().eq("id", id).eq("organization_id", user.organization.id).select("storage_path");
  const path = data?.[0]?.storage_path;
  if (path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
}
