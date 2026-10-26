import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { isMediaPathFor, MAX_FILES_PER_PROPERTY, MEDIA_BUCKET, type MediaKind } from "@/lib/media/rules";
import { createClient } from "@/lib/supabase/server";

// Property photos and videos. Files are in a private bucket; pages get
// short-lived signed links. RLS and the storage policies limit everything to
// the user's workspace.

const LINK_SECONDS = 60 * 60;

export type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string | null;
  thumbUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  isCover: boolean;
};

type Row = {
  id: string;
  kind: MediaKind;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  is_cover: boolean;
};

async function signed(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, LINK_SECONDS);
  if (error) console.error("signed urls failed", error.message);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}

/** Cover first, then in the agent's order. */
export async function listMedia(user: CurrentUser, propertyId: string): Promise<MediaItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_media")
    .select("id, kind, storage_path, thumb_path, mime_type, size_bytes, width, height, duration_seconds, is_cover")
    .eq("organization_id", user.organization.id)
    .eq("property_id", propertyId)
    .order("is_cover", { ascending: false })
    .order("position")
    .order("created_at");
  if (error) throw new Error(`Failed to load media: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const links = await signed(rows.flatMap((r) => [r.storage_path, ...(r.thumb_path ? [r.thumb_path] : [])]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    url: links.get(r.storage_path) ?? null,
    thumbUrl: (r.thumb_path && links.get(r.thumb_path)) || (r.kind === "photo" ? (links.get(r.storage_path) ?? null) : null),
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    width: r.width,
    height: r.height,
    durationSeconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
    isCover: r.is_cover,
  }));
}

/** Preview links of the cover (or first photo) for each property in a list. */
export async function coverThumbs(user: CurrentUser, propertyIds: string[]): Promise<Record<string, string>> {
  if (!propertyIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_media")
    .select("property_id, kind, storage_path, thumb_path, is_cover, position, created_at")
    .eq("organization_id", user.organization.id)
    .in("property_id", propertyIds)
    .order("is_cover", { ascending: false })
    .order("position")
    .order("created_at");
  const first = new Map<string, string>();
  for (const r of data ?? []) {
    const path = r.thumb_path ?? (r.kind === "photo" ? r.storage_path : null);
    if (path && !first.has(r.property_id)) first.set(r.property_id, path);
  }
  const links = await signed([...first.values()]);
  return Object.fromEntries([...first].flatMap(([id, path]) => (links.get(path) ? [[id, links.get(path)!]] : [])));
}

export type NewMedia = {
  kind: MediaKind;
  storagePath: string;
  thumbPath: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

async function fileExists(path: string) {
  const supabase = await createClient();
  const slash = path.lastIndexOf("/");
  const { data } = await supabase.storage.from(MEDIA_BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return Boolean(data?.some((f) => f.name === path.slice(slash + 1)));
}

/** Records files the browser has uploaded. The first photo of a property becomes its cover. */
export async function addMedia(user: CurrentUser, propertyId: string, item: NewMedia): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = user.organization.id;
  if (!isMediaPathFor(item.storagePath, org, propertyId) || (item.thumbPath && !isMediaPathFor(item.thumbPath, org, propertyId, true))) {
    return { ok: false, error: "Érvénytelen fájlhely." };
  }
  if (!(await fileExists(item.storagePath))) return { ok: false, error: "A feltöltött fájl nem található. Próbáld újra." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("property_media")
    .select("position, is_cover, kind")
    .eq("organization_id", org)
    .eq("property_id", propertyId);
  const list = existing ?? [];
  if (list.length >= MAX_FILES_PER_PROPERTY) return { ok: false, error: `Egy ingatlanhoz legfeljebb ${MAX_FILES_PER_PROPERTY} fájl tölthető fel.` };

  const { error } = await supabase.from("property_media").insert({
    organization_id: org,
    property_id: propertyId,
    kind: item.kind,
    storage_path: item.storagePath,
    thumb_path: item.thumbPath,
    mime_type: item.mimeType,
    size_bytes: item.sizeBytes,
    width: item.width,
    height: item.height,
    duration_seconds: item.durationSeconds,
    position: list.reduce((m, r) => Math.max(m, r.position + 1), 0),
    is_cover: item.kind === "photo" && !list.some((r) => r.is_cover),
  });
  if (error) {
    console.error("add media failed", error.code);
    return { ok: false, error: error.code === "23503" ? "Az ingatlan nem található." : "A mentés nem sikerült." };
  }
  return { ok: true };
}

async function getRow(user: CurrentUser, id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_media")
    .select("id, property_id, kind, storage_path, thumb_path, position, is_cover")
    .eq("organization_id", user.organization.id)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Deletes the files first, then the record, so nothing is left behind unreachable. */
export async function deleteMedia(user: CurrentUser, id: string) {
  const row = await getRow(user, id);
  if (!row) return null;
  const supabase = await createClient();
  const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove([row.storage_path, ...(row.thumb_path ? [row.thumb_path] : [])]);
  if (removeError) throw new Error(`Failed to delete media files: ${removeError.message}`);
  const { error } = await supabase.from("property_media").delete().eq("id", id).eq("organization_id", user.organization.id);
  if (error) throw new Error(`Failed to delete media: ${error.code}`);
  // A deleted cover passes to the next photo.
  if (row.is_cover) {
    const { data: next } = await supabase
      .from("property_media")
      .select("id")
      .eq("organization_id", user.organization.id)
      .eq("property_id", row.property_id)
      .eq("kind", "photo")
      .order("position")
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from("property_media").update({ is_cover: true }).eq("id", next.id);
  }
  return row.property_id as string;
}

export async function setCover(user: CurrentUser, id: string) {
  const row = await getRow(user, id);
  if (!row || row.kind !== "photo") return null;
  const supabase = await createClient();
  // One cover per property (unique index): clear the old one first.
  await supabase.from("property_media").update({ is_cover: false }).eq("organization_id", user.organization.id).eq("property_id", row.property_id).eq("is_cover", true);
  const { error } = await supabase.from("property_media").update({ is_cover: true }).eq("id", id).eq("organization_id", user.organization.id);
  if (error) throw new Error(`Failed to set cover: ${error.code}`);
  return row.property_id as string;
}

/** Swaps an item with its neighbour in the gallery order. */
export async function moveMedia(user: CurrentUser, id: string, direction: -1 | 1) {
  const row = await getRow(user, id);
  if (!row) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_media")
    .select("id, position")
    .eq("organization_id", user.organization.id)
    .eq("property_id", row.property_id)
    .eq("is_cover", false)
    .order("position")
    .order("created_at");
  const list = data ?? [];
  const i = list.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return row.property_id as string;
  // Renumber so equal positions can't block a swap.
  const order = list.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(order.map((mid, position) => supabase.from("property_media").update({ position }).eq("id", mid).eq("organization_id", user.organization.id)));
  return row.property_id as string;
}
