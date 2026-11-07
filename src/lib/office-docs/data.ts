import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/documents/data";
import { createClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/team";

// Dokumentumok: the office's shared files in the private "documents" bucket,
// under "<workspace>/office/". The browser uploads straight into that folder;
// here they are listed with short-lived download links, renamed, pinned,
// moved between folders and removed (uploader or manager; RLS checks it too).

export const OFFICE_FOLDERS = ["templates", "contracts", "marketing", "office", "general"] as const;
export type OfficeFolder = (typeof OFFICE_FOLDERS)[number];
export const folderLabels: Record<OfficeFolder, string> = {
  templates: "Sablonok",
  contracts: "Szerződésminták",
  marketing: "Marketing",
  office: "Irodai ügyek",
  general: "Egyéb",
};

export type OfficeDocument = {
  id: string;
  title: string;
  fileName: string;
  folder: OfficeFolder;
  sizeBytes: number;
  mimeType: string | null;
  pinned: boolean;
  createdAt: string;
  uploader: string | null;
  url: string | null;
  canEdit: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_SECONDS = 3600;
const isFolder = (f: string): f is OfficeFolder => (OFFICE_FOLDERS as readonly string[]).includes(f);

export async function listOfficeDocuments(user: CurrentUser): Promise<OfficeDocument[]> {
  const supabase = await createClient();
  const [{ data }, { members }] = await Promise.all([
    supabase
      .from("office_documents")
      .select("id, title, file_name, folder, size_bytes, mime_type, pinned, created_at, created_by, storage_path")
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
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    fileName: r.file_name,
    folder: isFolder(r.folder) ? r.folder : "general",
    sizeBytes: Number(r.size_bytes),
    mimeType: r.mime_type,
    pinned: r.pinned,
    createdAt: r.created_at,
    uploader: r.created_by ? (names.get(r.created_by) ?? null) : null,
    url: url.get(r.storage_path) ?? null,
    canEdit: manager || r.created_by === user.id,
  }));
}

/** Records a file the browser uploaded into the workspace's office folder. */
export async function addOfficeDocument(user: CurrentUser, d: { path: string; fileName: string; size: number; mimeType: string; folder: string }) {
  if (!d.path.startsWith(`${user.organization.id}/office/`) || d.path.includes("..") || d.path.length > 500) return { ok: false as const, error: "Érvénytelen fájl." };
  const supabase = await createClient();
  const title = d.fileName.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Dokumentum";
  const { error } = await supabase.from("office_documents").insert({
    organization_id: user.organization.id,
    folder: isFolder(d.folder) ? d.folder : "general",
    title,
    storage_path: d.path,
    file_name: d.fileName.slice(0, 300),
    size_bytes: Math.max(0, Math.round(d.size)),
    mime_type: d.mimeType.slice(0, 200) || null,
  });
  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([d.path]);
    console.error("office document save failed", error.code);
    return { ok: false as const, error: "A fájlt nem sikerült menteni." };
  }
  return { ok: true as const };
}

export async function updateOfficeDocument(user: CurrentUser, id: string, patch: { title?: string; folder?: string; pinned?: boolean }) {
  if (!UUID.test(id)) return;
  const update: Record<string, unknown> = {};
  if (patch.title != null && patch.title.trim()) update.title = patch.title.trim().slice(0, 200);
  if (patch.folder != null && isFolder(patch.folder)) update.folder = patch.folder;
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
