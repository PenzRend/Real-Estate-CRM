"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useOptimistic, useRef, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { setPropertyStatusAction } from "@/app/(app)/properties/actions";
import { propertyStatusTone, tones } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { propertyStatusLabels, type PropertyStatus } from "@/lib/i18n/labels";

const ORDER: PropertyStatus[] = ["draft", "active", "reserved", "under_negotiation", "sold", "rented", "inactive"];

/** Strong colour of each badge tone, for the dots in the menu. */
const DOT = { neutral: "bg-subtle", accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger", dark: "bg-primary" } as const;

/**
 * The status badge, as a button: one click opens the statuses, another sets
 * one. Shows the new status at once and saves in the background.
 */
export function PropertyStatusPicker({ id, status, align = "left" }: { id: string; status: PropertyStatus; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  // Shows the chosen status at once; returns to the saved one if saving fails.
  const [shown, setShown] = useOptimistic(status);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const [pos, setPos] = useState<CSSProperties>({});
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);

  /**
   * The menu is placed over the page (portal, fixed position) at the badge, so
   * tables and cards that clip their content can't cut it off. It opens
   * upwards when there isn't room below.
   */
  function toggle() {
    if (open) return setOpen(false);
    const r = box.current!.getBoundingClientRect();
    const MENU_HEIGHT = 290;
    const vertical = r.bottom + MENU_HEIGHT > window.innerHeight ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 };
    const horizontal = align === "right" ? { right: window.innerWidth - r.right } : { left: r.left };
    setPos({ position: "fixed", ...vertical, ...horizontal });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) return e.key === "Escape" && setOpen(false);
      const target = e.target as Node;
      if (!box.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    // The fixed menu would drift from its badge on scroll; close it instead.
    const dismiss = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  function choose(next: PropertyStatus) {
    setOpen(false);
    if (next === shown) return;
    setError(false);
    start(async () => {
      setShown(next);
      try {
        await setPropertyStatusAction(id, next);
      } catch {
        setError(true);
      }
    });
  }

  return (
    // Above row links that cover the whole row (property list).
    <div ref={box} className="relative z-10 inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Státusz módosítása"
        className={cn(
          "inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-xs font-medium whitespace-nowrap transition-shadow hover:ring-2 hover:ring-border-strong",
          tones[propertyStatusTone[shown]],
          error && "ring-2 ring-danger",
        )}
      >
        {propertyStatusLabels[shown]}
        {pending ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />}
      </button>
      {open &&
        createPortal(
          <ul ref={menu} role="menu" style={pos} className="z-50 w-48 rounded-xl border border-border bg-background p-1 shadow-float">
            {ORDER.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={s === shown}
                  onClick={() => choose(s)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", DOT[propertyStatusTone[s]])} />
                  <span className="flex-1">{propertyStatusLabels[s]}</span>
                  {s === shown && <Check className="size-3.5 text-muted" />}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
      {error && <span className="sr-only">A státusz mentése nem sikerült.</span>}
    </div>
  );
}
