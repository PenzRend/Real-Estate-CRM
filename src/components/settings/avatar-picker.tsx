"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { removeAvatarAction, saveAvatarAction } from "@/app/(app)/settings/actions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { actionFailed } from "@/lib/action-failed";
import { AVATARS_BUCKET } from "@/lib/avatar";
import { createBrowserSupabase } from "@/lib/supabase/client";

const SIZE = 320;

/** The picked photo, cut to a centred square and shrunk, as WebP: small and the same shape everywhere. */
async function squareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/webp", 0.86));
}

export function AvatarPicker({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const blob = await squareWebp(file);
        const path = `${userId}/${crypto.randomUUID()}.webp`;
        const up = await createBrowserSupabase().storage.from(AVATARS_BUCKET).upload(path, blob, { contentType: "image/webp", upsert: false });
        if (up.error) throw up.error;
        const r = await saveAvatarAction(path).catch(actionFailed);
        if (!r.ok) throw new Error(r.error);
        setPreview(URL.createObjectURL(blob));
      } catch {
        setError("A képet nem sikerült feltölteni. JPG, PNG vagy WebP lehet.");
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="group relative rounded-full" aria-label="Profilkép cseréje">
        <UserAvatar name={name || "?"} url={preview} size="xl" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="text-sm font-medium text-ink hover:text-accent">
          {preview ? "Kép cseréje" : "Profilkép feltöltése"}
        </button>
        {preview && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                await removeAvatarAction().catch(actionFailed);
                setPreview(null);
              })
            }
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
          >
            <Trash2 className="size-3" /> Eltávolítás
          </button>
        )}
        <p className="text-xs text-muted">{error ?? "A kollégáid és az üzenetek mellett ez látszik."}</p>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
