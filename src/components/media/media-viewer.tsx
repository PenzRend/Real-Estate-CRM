"use client";

import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/lib/db/media";

/**
 * Full-screen viewer: the photo fills the screen over a blurred copy of its
 * preview, which shows at once while the full-size file loads; neighbours are
 * loaded ahead, a thumbnail strip jumps anywhere, and arrows, keys and swipes
 * move through. Esc closes (native dialog).
 */
export function MediaViewer({ items, index, onIndex, onClose }: { items: MediaItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const swipeFrom = useRef<number | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const item = items[index];
  const go = (i: number) => {
    if (i >= 0 && i < items.length) onIndex(i);
  };

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  // Load the neighbours ahead, so moving on feels instant.
  useEffect(() => {
    for (const n of [items[index + 1], items[index - 1]]) {
      if (n?.kind === "photo" && n.url) new Image().src = n.url;
    }
    strip.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index, items]);

  const loaded = loadedId === item.id;
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-[#0b0d0e] p-0 text-white backdrop:bg-black/90"
      aria-label="Fotók és videók"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3 text-sm sm:px-6">
          <span className="tabular-nums text-white/70">
            {index + 1} / {items.length}
          </span>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Bezárás" className="grid size-10 place-items-center rounded-full hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden select-none"
          onPointerDown={(e) => (swipeFrom.current = e.clientX)}
          onPointerUp={(e) => {
            if (swipeFrom.current == null) return;
            const dx = e.clientX - swipeFrom.current;
            swipeFrom.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? index + 1 : index - 1);
          }}
        >
          {item.kind === "video" ? (
            <video key={item.id} src={item.url ?? undefined} poster={item.thumbUrl ?? undefined} controls autoPlay playsInline className="max-h-full max-w-full" />
          ) : (
            <>
              {/* The preview, blurred and dimmed, fills the screen while the full photo loads. */}
              {item.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${item.id}-bg`} src={item.thumbUrl} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
              )}
              {item.thumbUrl && !loaded && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${item.id}-thumb`} src={item.thumbUrl} alt="" aria-hidden className="relative max-h-full max-w-full object-contain blur-[2px]" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={item.id}
                src={item.url ?? undefined}
                alt=""
                decoding="async"
                onLoad={() => setLoadedId(item.id)}
                className={cn(
                  "max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-300",
                  loaded ? "relative opacity-100" : "absolute opacity-0",
                )}
              />
            </>
          )}

          {index > 0 && (
            <button type="button" onClick={() => go(index - 1)} aria-label="Előző" className="absolute left-3 grid size-12 place-items-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60 sm:left-6">
              <ChevronLeft className="size-6" />
            </button>
          )}
          {index < items.length - 1 && (
            <button type="button" onClick={() => go(index + 1)} aria-label="Következő" className="absolute right-3 grid size-12 place-items-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60 sm:right-6">
              <ChevronRight className="size-6" />
            </button>
          )}
        </div>

        {items.length > 1 && (
          <div ref={strip} className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:justify-center sm:px-6">
            {items.map((m, i) => (
              <button
                key={m.id}
                type="button"
                data-index={i}
                onClick={() => go(i)}
                aria-label={`${i + 1}. elem`}
                aria-current={i === index}
                className={cn(
                  "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg transition-[opacity,box-shadow]",
                  i === index ? "opacity-100 ring-2 ring-white" : "opacity-45 hover:opacity-80",
                )}
              >
                {m.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                )}
                {m.kind === "video" && (
                  <span className="absolute inset-0 grid place-items-center bg-black/30">
                    <Play className="size-4 fill-current" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
