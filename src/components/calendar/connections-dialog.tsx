"use client";

import { Settings2, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Naptárak" on the calendar page: the connections in a popup. The content
 * stays mounted, so a form the agent is filling in survives closing it.
 */
export function ConnectionsDialog({ children, attention }: { children: ReactNode; attention?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => dialog.current?.showModal()} className="relative">
        <Settings2 /> Naptárak
        {attention && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-warning ring-2 ring-background" aria-label="Figyelmet igényel" />}
      </Button>
      <dialog
        ref={dialog}
        // A click on the backdrop (the dialog element itself, outside the panel) closes it.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(72rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
        aria-label="Naptárak kezelése"
      >
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <h2 className="text-xl">Naptárak kezelése</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Bezárás" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto p-6">{children}</div>
        </div>
      </dialog>
    </>
  );
}
