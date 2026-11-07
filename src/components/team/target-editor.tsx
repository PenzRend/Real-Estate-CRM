"use client";

import { Target } from "lucide-react";
import { useState } from "react";
import type { AgentTarget } from "@/lib/team/stats";
import { TargetField } from "./target-field";

const fields = [
  { key: "commission", label: "Jutalék (Ft)" },
  { key: "deals", label: "Lezárt ügylet" },
  { key: "listings", label: "Új megbízás" },
  { key: "viewings", label: "Megtekintés" },
] as const;

/** "Célok" on an agent's card: the month's four targets, each saved when its field is left. */
export function TargetEditor({ userId, name, month, target }: { userId: string; name: string; month: string; target: AgentTarget | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink"
      >
        <Target className="size-3.5" /> {target ? "Célok módosítása" : "Havi célok megadása"}
      </button>
      {open && (
        <div className="reveal flex flex-col gap-2.5 rounded-2xl bg-surface py-4 pr-8 pl-4">
          {fields.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 text-sm text-muted">
              {f.label}
              <TargetField userId={userId} month={month} field={f.key} value={target?.[f.key] ?? null} label={`${name} – ${f.label} cél`} />
            </label>
          ))}
          <p className="text-xs text-subtle">Mezőből kilépve mentjük.</p>
        </div>
      )}
    </div>
  );
}
