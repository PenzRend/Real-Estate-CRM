"use client";

import { Images, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/lib/db/media";
import { FadeImage } from "./fade-image";

function duration(s: number | null) {
  if (s == null) return null;
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

function Cell({ item, big, more, onOpen, className }: { item: MediaItem; big?: boolean; more?: number; onOpen: () => void; className?: string }) {
  // Large cells get the full photo, small ones the preview: sharp without loading 30 full files.
  const src = big && item.kind === "photo" ? (item.url ?? item.thumbUrl) : (item.thumbUrl ?? item.url);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("group relative block overflow-hidden bg-surface-strong", className)}
      aria-label={item.kind === "video" ? "Videó megnyitása" : "Fotó megnyitása"}
    >
      {src && <FadeImage src={src} eager={big} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      {item.kind === "video" && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            <Play className="size-3.5 fill-current" /> {duration(item.durationSeconds) ?? "Videó"}
          </span>
        </span>
      )}
      {more ? (
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-lg font-medium text-white backdrop-blur-[1px]">+{more}</span>
      ) : null}
    </button>
  );
}

/**
 * The listing's photos as a calm, fixed-height mosaic (cover plus up to four),
 * so nothing jumps while images arrive. Every cell opens the full-screen viewer.
 */
export function MediaMosaic({ items, onOpen }: { items: MediaItem[]; onOpen: (index: number) => void }) {
  const shown = items.slice(0, 5);
  const more = items.length - shown.length;
  const allButton = (
    <button
      type="button"
      onClick={() => onOpen(0)}
      className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-xs font-medium text-ink shadow-float backdrop-blur hover:bg-white"
    >
      <Images className="size-3.5" /> Összes ({items.length})
    </button>
  );

  if (shown.length === 1) {
    return (
      <div className="relative h-72 overflow-hidden rounded-2xl sm:h-[28rem]">
        <Cell item={shown[0]} big onOpen={() => onOpen(0)} className="size-full" />
      </div>
    );
  }
  if (shown.length === 2) {
    return (
      <div className="relative grid h-72 grid-cols-2 gap-1.5 overflow-hidden rounded-2xl sm:h-[28rem]">
        {shown.map((m, i) => (
          <Cell key={m.id} item={m} big onOpen={() => onOpen(i)} className="size-full" />
        ))}
        {allButton}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative grid h-72 gap-1.5 overflow-hidden rounded-2xl sm:h-[28rem]",
        shown.length >= 5 ? "sm:grid-cols-4 sm:grid-rows-2" : "sm:grid-cols-[2fr_1fr] sm:grid-rows-2",
      )}
    >
      <Cell item={shown[0]} big onOpen={() => onOpen(0)} className={cn("size-full sm:row-span-2", shown.length >= 5 && "sm:col-span-2")} />
      {shown.slice(1).map((m, i) => (
        <Cell
          key={m.id}
          item={m}
          more={i === shown.length - 2 && more > 0 ? more : undefined}
          onOpen={() => onOpen(i + 1)}
          className={cn("hidden size-full sm:block", shown.length === 3 && "sm:row-span-1")}
        />
      ))}
      {allButton}
    </div>
  );
}
