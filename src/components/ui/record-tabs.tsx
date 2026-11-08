"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// A record's page in a few tabs instead of one long scroll: the everyday
// view first, the rest one tap away. Every tab is rendered on the server and
// only hidden, so switching is instant; the open tab is kept in the address
// (?tab=…) so a link can open the right one.

export type RecordTab = { id: string; label: string; count?: number | null; content: ReactNode };

export function RecordTabs({ tabs, initial }: { tabs: RecordTab[]; initial?: string | null }) {
  const shown = tabs.filter((t) => t.content != null && t.content !== false);
  const [active, setActive] = useState(shown.some((t) => t.id === initial) ? initial! : shown[0]?.id);

  const open = (id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === shown[0]?.id) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Nézetek" className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-background/90 px-1 py-1 backdrop-blur [scrollbar-width:none]">
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            onClick={() => open(t.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
              t.id === active ? "bg-ink text-background" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 && <span className={cn("text-xs tabular-nums", t.id === active ? "text-background/70" : "text-subtle")}>{t.count}</span>}
          </button>
        ))}
      </div>
      {shown.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== active} className={t.id === active ? "reveal" : undefined}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
