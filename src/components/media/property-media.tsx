"use client";

import { Check, ChevronLeft, ChevronRight, CircleAlert, ImagePlus, Loader2, Play, Settings2, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { addMediaAction, deleteMediaAction, moveMediaAction, setCoverAction } from "@/app/(app)/properties/[id]/media-actions";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/lib/db/media";
import { clearPending, clearStoredImages, loadPendingImage, readPending } from "@/lib/listings/pending-media";
import { preparePhoto, prepareVideo } from "@/lib/media/process";
import { acceptMedia, formatBytes, MAX_FILES_PER_PROPERTY, MEDIA_BUCKET, mediaPath, PHOTO_INPUT_MAX_MB, VIDEO_MAX_MB } from "@/lib/media/rules";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { FadeImage } from "./fade-image";
import { MediaMosaic } from "./media-mosaic";
import { MediaViewer } from "./media-viewer";

type Upload = { name: string; status: "preparing" | "uploading" | "done" | "error"; error?: string };

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";

function duration(s: number | null) {
  if (s == null) return null;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

/** A photo in "Fotók kezelése": cover, order and delete controls. */
function Tile({
  item,
  canLeft,
  canRight,
  onOpen,
}: {
  item: MediaItem;
  canLeft: boolean;
  canRight: boolean;
  onOpen: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const btn = "grid size-8 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink disabled:opacity-50";
  return (
    <li className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-strong">
      <button type="button" onClick={onOpen} className="block size-full" aria-label={item.kind === "video" ? "Videó megnyitása" : "Fotó megnyitása"}>
        {item.thumbUrl ? (
          <FadeImage src={item.thumbUrl} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-xs text-muted">Nincs előnézet</span>
        )}
        {item.kind === "video" && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-medium text-white">
              <Play className="size-3.5 fill-current" /> {duration(item.durationSeconds) ?? "Videó"}
            </span>
          </span>
        )}
      </button>
      {item.isCover && (
        <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-ink">Borítókép</span>
      )}
      {confirming ? (
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-xl bg-background/95 px-3 py-2 text-xs shadow-float">
          <span className="text-ink">Törlöd?</span>
          <span className="flex gap-1">
            <button type="button" disabled={busy} onClick={() => run(() => deleteMediaAction(item.id))} className="rounded-full bg-danger px-3 py-1 font-medium text-white disabled:opacity-50">
              {busy ? "…" : "Törlés"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-2 py-1 text-muted hover:text-ink">
              Mégse
            </button>
          </span>
        </div>
      ) : (
        <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {item.kind === "photo" && !item.isCover && (
            <button type="button" disabled={busy} onClick={() => run(() => setCoverAction(item.id))} title="Legyen ez a borítókép" aria-label="Borítókép" className={btn}>
              <Star className="size-4" />
            </button>
          )}
          {canLeft && (
            <button type="button" disabled={busy} onClick={() => run(() => moveMediaAction(item.id, -1))} title="Előrébb" aria-label="Előrébb" className={btn}>
              <ChevronLeft className="size-4" />
            </button>
          )}
          {canRight && (
            <button type="button" disabled={busy} onClick={() => run(() => moveMediaAction(item.id, 1))} title="Hátrébb" aria-label="Hátrébb" className={btn}>
              <ChevronRight className="size-4" />
            </button>
          )}
          <button type="button" onClick={() => setConfirming(true)} title="Törlés" aria-label="Törlés" className={btn}>
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </li>
  );
}

export function PropertyMedia({
  propertyId,
  organizationId,
  items,
  sourceUrl,
}: {
  propertyId: string;
  organizationId: string;
  items: MediaItem[];
  /** For imported listings: photos chosen during the import are uploaded on first view. */
  sourceUrl?: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [managing, setManaging] = useState(false);
  const busy = uploads.some((u) => u.status === "preparing" || u.status === "uploading");

  const setStatus = (i: number, patch: Partial<Upload>) => setUploads((list) => list.map((u, j) => (j === i ? { ...u, ...patch } : u)));

  async function uploadOne(file: File, i: number) {
    const accepted = acceptMedia(file);
    if (!accepted.ok) return setStatus(i, { status: "error", error: accepted.error });
    const supabase = createBrowserSupabase();
    const fileId = crypto.randomUUID();
    const uploaded: string[] = [];
    try {
      let body: Blob;
      let mimeType: string;
      let thumb: Blob | null;
      let meta: { width: number | null; height: number | null; duration: number | null };
      if (accepted.kind === "photo") {
        const p = await preparePhoto(file);
        body = p.file;
        mimeType = p.mimeType;
        thumb = p.thumb;
        meta = { width: p.width, height: p.height, duration: null };
      } else {
        const v = await prepareVideo(file);
        body = file;
        mimeType = file.type;
        thumb = v.thumb;
        meta = { width: v.width, height: v.height, duration: v.duration };
      }
      setStatus(i, { status: "uploading" });
      const path = mediaPath(organizationId, propertyId, fileId, mimeType);
      const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, body, { contentType: mimeType, upsert: false });
      if (up.error) throw new Error(up.error.message.includes("exceeded") ? `A fájl túl nagy (max. ${VIDEO_MAX_MB} MB).` : "A feltöltés nem sikerült.");
      uploaded.push(path);
      let thumbPath: string | null = null;
      if (thumb) {
        thumbPath = mediaPath(organizationId, propertyId, fileId, mimeType, true);
        const t = await supabase.storage.from(MEDIA_BUCKET).upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: false });
        if (t.error) thumbPath = null;
        else uploaded.push(thumbPath);
      }
      const r = await addMediaAction(propertyId, {
        kind: accepted.kind,
        storagePath: path,
        thumbPath,
        mimeType,
        sizeBytes: body.size,
        width: meta.width,
        height: meta.height,
        durationSeconds: meta.duration == null ? null : Math.round(meta.duration * 100) / 100,
      });
      if (!r.ok) throw new Error(r.error);
      setStatus(i, { status: "done" });
    } catch (error) {
      // Nothing half-saved: remove what reached storage.
      if (uploaded.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploaded);
      setStatus(i, { status: "error", error: `${file.name}: ${error instanceof Error && error.message ? error.message : "A feltöltés nem sikerült."}` });
    }
  }

  async function upload(files: File[]) {
    if (!files.length || busy) return;
    const room = MAX_FILES_PER_PROPERTY - items.length;
    const list = files.slice(0, Math.max(0, room));
    const start: Upload[] = list.map((f) => ({ name: f.name, status: "preparing" }));
    if (files.length > list.length) start.push({ name: "", status: "error", error: `Egy ingatlanhoz legfeljebb ${MAX_FILES_PER_PROPERTY} fájl tölthető fel.` });
    setUploads(start);
    // One at a time: phones on mobile data and the storage service both cope better.
    for (const [i, f] of list.entries()) await uploadOne(f, i);
    router.refresh();
    setUploads((u) => u.filter((x) => x.status === "error"));
  }

  // Photos picked on the import screen: fetch each and upload it like a manual upload.
  const importStarted = useRef(false);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => {
    if (!sourceUrl || importStarted.current) return;
    const pendingSelection = readPending(sourceUrl);
    if (!pendingSelection) return;
    importStarted.current = true;
    // The selection is used once, even if the page is left halfway.
    clearPending(sourceUrl);
    void (async () => {
      const list = pendingSelection.images.slice(0, Math.max(0, MAX_FILES_PER_PROPERTY - items.length));
      setImporting({ done: 0, total: list.length });
      setUploads(list.map((u) => ({ name: decodeURIComponent(new URL(u).pathname.split("/").pop() || "foto"), status: "preparing" })));
      for (const [i, imageUrl] of list.entries()) {
        const file = await loadPendingImage(sourceUrl, imageUrl, pendingSelection.source);
        if (file) await uploadOne(file, i);
        else setStatus(i, { status: "error", error: `${imageUrl.split("/").pop()}: a fotót nem sikerült letölteni a hirdetésből.` });
        setImporting({ done: i + 1, total: list.length });
      }
      await clearStoredImages(sourceUrl);
      setImporting(null);
      router.refresh();
      setUploads((u) => u.filter((x) => x.status === "error"));
    })();
    // Runs once per page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void upload([...e.dataTransfer.files]);
  };

  const totalBytes = items.reduce((s, i) => s + i.sizeBytes, 0);
  const photos = items.filter((i) => i.kind === "photo").length;
  return (
    <Card
      className={cn("p-3 transition-colors sm:p-4", dragging && "border-ink bg-surface")}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-base tracking-tight">
            Fotók és videók{" "}
            {items.length > 0 && (
              <span className="text-sm font-normal text-muted">
                · {photos} fotó, {items.length - photos} videó · {formatBytes(totalBytes)}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setManaging((m) => !m)}
                aria-pressed={managing}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium",
                  managing ? "bg-ink text-white" : "border border-border-strong text-ink hover:bg-surface",
                )}
              >
                {managing ? <Check className="size-3.5" /> : <Settings2 className="size-3.5" />} {managing ? "Kész" : "Fotók kezelése"}
              </button>
            )}
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} {busy ? "Feltöltés…" : "Feltöltés"}
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              void upload([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && !managing ? (
          <MediaMosaic items={items} onOpen={setViewing} />
        ) : items.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((item, i) => (
              <Tile
                key={item.id}
                item={item}
                // Order applies to everything after the cover.
                canLeft={!item.isCover && i > 0 && !items[i - 1].isCover}
                canRight={!item.isCover && i < items.length - 1}
                onOpen={() => setViewing(i)}
              />
            ))}
          </ul>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center hover:bg-surface"
          >
            <ImagePlus className="size-6 text-muted" />
            <span className="text-sm font-medium text-ink">Húzd ide a fotókat és videókat, vagy kattints</span>
            <span className="text-xs text-muted">
              JPG, PNG, WebP fotó (max. {PHOTO_INPUT_MAX_MB} MB) · MP4, WebM, MOV videó (max. {VIDEO_MAX_MB} MB). A fotókat feltöltés előtt
              átméretezzük, és eltávolítjuk belőlük a helyadatokat.
            </span>
          </button>
        )}

        {importing && (
          <p role="status" className="mt-3 flex items-center gap-2 px-1 text-sm text-ink">
            <Loader2 className="size-4 animate-spin text-accent" /> Fotók importálása a hirdetésből: {importing.done} / {importing.total}
          </p>
        )}
        {uploads.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 px-1 text-xs">
            {uploads.map((u, i) => (
              <li key={i} className={cn("flex items-start gap-1.5", u.status === "error" ? "text-danger" : "text-muted")}>
                {u.status === "error" ? <CircleAlert className="mt-px size-3.5 shrink-0" /> : u.status === "done" ? <span>✓</span> : <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" />}
                {u.status === "error" ? u.error : `${u.name}: ${u.status === "preparing" ? "előkészítés" : u.status === "uploading" ? "feltöltés" : "kész"}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {viewing != null && items[viewing] && <MediaViewer items={items} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}
