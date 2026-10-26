// Which files a property gallery accepts, how big they may be, and where they
// are stored. Pure functions, shared by the browser upload and the server.

export const MEDIA_BUCKET = "property-media";

/** Photos are downscaled in the browser; this is the size of the original we accept. */
export const PHOTO_INPUT_MAX_MB = 40;
/** The storage plan's per-file limit (Supabase Free: 50 MB). Raise with the plan. */
export const VIDEO_MAX_MB = 50;
export const MAX_FILES_PER_PROPERTY = 60;

/** Long side of a stored photo and of a preview, in pixels. */
export const PHOTO_MAX_SIDE = 2560;
export const THUMB_MAX_SIDE = 640;

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export type MediaKind = "photo" | "video";

export type Acceptance = { ok: true; kind: MediaKind } | { ok: false; error: string };

export function acceptMedia(file: { name: string; type: string; size: number }): Acceptance {
  const mb = file.size / 1024 / 1024;
  const type = file.type.toLowerCase();
  if (PHOTO_TYPES.includes(type)) {
    return mb <= PHOTO_INPUT_MAX_MB ? { ok: true, kind: "photo" } : { ok: false, error: `${file.name}: a fotó nagyobb ${PHOTO_INPUT_MAX_MB} MB-nál.` };
  }
  if (VIDEO_TYPES.includes(type)) {
    return mb <= VIDEO_MAX_MB
      ? { ok: true, kind: "video" }
      : { ok: false, error: `${file.name}: a videó ${Math.round(mb)} MB, a jelenlegi tárhelycsomagban legfeljebb ${VIDEO_MAX_MB} MB lehet. Vágd rövidebbre vagy töltsd fel kisebb felbontásban.` };
  }
  if (/heic|heif/.test(type) || /\.(heic|heif)$/i.test(file.name)) {
    return { ok: false, error: `${file.name}: a HEIC formátumot a böngészők nem jelenítik meg. iPhone-on: Beállítások → Kamera → Formátumok → „Legkompatibilisebb”, vagy küldd át JPG-ként.` };
  }
  return { ok: false, error: `${file.name}: csak JPG, PNG, WebP fotó és MP4, WebM, MOV videó tölthető fel.` };
}

/** Fits width × height inside a square of `max`, never enlarging. */
export function scaledSize(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** <organization>/<property>/<file id>[-thumb].<ext> — the folder is what storage access checks. */
export function mediaPath(organizationId: string, propertyId: string, fileId: string, mimeType: string, thumb = false) {
  return `${organizationId}/${propertyId}/${fileId}${thumb ? "-thumb" : ""}.${thumb ? "jpg" : EXT[mimeType]}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** True when a path was made by mediaPath for this workspace and property. */
export function isMediaPathFor(path: string, organizationId: string, propertyId: string, thumb = false) {
  const prefix = `${organizationId}/${propertyId}/`;
  if (!path.startsWith(prefix)) return false;
  const file = path.slice(prefix.length);
  return new RegExp(thumb ? `^${UUID}-thumb\\.jpg$` : `^${UUID}\\.(jpg|png|webp|mp4|webm|mov)$`).test(file);
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
}
