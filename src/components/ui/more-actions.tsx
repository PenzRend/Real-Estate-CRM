"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * A "…" button for actions used now and then (archive, portals), so a page's
 * header shows only the everyday ones. The menu is hidden, not unmounted, when
 * closed: an action started inside it still finishes and shows its note.
 */
export function MoreActions({ children, label = "További műveletek" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={buttonClasses("secondary")}>
        <MoreHorizontal />
      </button>
      <div
        // A click on an item closes the menu once the item's own handler has run.
        onClick={() => setTimeout(() => setOpen(false))}
        className={cn(
          "menu-motion absolute right-0 z-30 mt-2 flex min-w-48 flex-col gap-1 rounded-2xl border border-border bg-background p-1.5 shadow-float",
          "[&_button]:w-full [&_button]:justify-start [&_button]:border-transparent [&_button]:shadow-none",
          !open && "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}
