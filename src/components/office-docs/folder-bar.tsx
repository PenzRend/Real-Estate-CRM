"use client";

import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createFolderAction, deleteFolderAction, renameFolderAction } from "@/app/(app)/documents/actions";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { OfficeFolder } from "@/lib/office-docs/data";

/** "all", "none" (files without a folder, "Egyéb") or a folder's id. */
export type FolderPick = "all" | "none" | string;

const chip = (on: boolean) =>
  cn("inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm", on ? "border-primary bg-primary font-medium text-white" : "border-border text-muted hover:border-border-strong hover:text-ink");

/** The folders as chips: pick one, add a new one, rename or remove the chosen one. */
export function FolderBar({ folders, counts, value, onChange }: { folders: OfficeFolder[]; counts: Record<string, number>; value: FolderPick; onChange: (v: FolderPick) => void }) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const current = folders.find((f) => f.id === value) ?? null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn().catch(actionFailed);
      if (!r.ok) toast({ message: ("error" in r && r.error) || "Nem sikerült." });
      else after?.();
    });

  const count = (k: string) => <span className={cn("ml-1.5 text-xs tabular-nums", value === k ? "text-white/70" : "text-subtle")}>{counts[k] ?? 0}</span>;

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Mappák" className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange("all")} aria-pressed={value === "all"} className={chip(value === "all")}>
          Mind{count("all")}
        </button>
        {folders.map((f) => (
          <button key={f.id} type="button" onClick={() => onChange(f.id)} aria-pressed={value === f.id} className={chip(value === f.id)}>
            {f.name}
            {count(f.id)}
          </button>
        ))}
        <button type="button" onClick={() => onChange("none")} aria-pressed={value === "none"} className={chip(value === "none")} title="Mappa nélküli fájlok">
          Egyéb{count("none")}
        </button>
        {adding ? (
          <form
            className="pop-in inline-flex items-center gap-1 rounded-full border border-ink py-0.5 pr-1 pl-3"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "");
              start(async () => {
                const r = await createFolderAction(name).catch(actionFailed);
                if (r.ok) {
                  setAdding(false);
                  if ("id" in r) onChange(r.id as string);
                } else toast({ message: ("error" in r && r.error) || "Nem sikerült." });
              });
            }}
          >
            <input name="name" autoFocus maxLength={60} placeholder="Mappa neve" aria-label="Új mappa neve" onKeyDown={(e) => e.key === "Escape" && setAdding(false)} className="w-36 bg-transparent text-sm focus:outline-none" />
            <button type="submit" disabled={busy} className="grid size-7 place-items-center rounded-full bg-primary text-white" aria-label="Mappa létrehozása">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="grid size-7 place-items-center rounded-full text-muted hover:text-ink" aria-label="Mégse">
              <X className="size-3.5" />
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border-strong px-3.5 py-1.5 text-sm text-muted hover:border-ink hover:text-ink">
            <Plus className="size-3.5" /> Új mappa
          </button>
        )}
      </nav>

      {current?.canEdit && (
        <div className="reveal flex flex-wrap items-center gap-2 text-sm">
          {renaming ? (
            <form
              className="inline-flex items-center gap-1 rounded-full border border-ink py-0.5 pr-1 pl-3"
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("name") ?? "");
                run(() => renameFolderAction(current.id, name), () => setRenaming(false));
              }}
            >
              <input name="name" autoFocus defaultValue={current.name} maxLength={60} aria-label="A mappa új neve" onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} className="w-40 bg-transparent text-sm focus:outline-none" />
              <button type="submit" disabled={busy} className="grid size-7 place-items-center rounded-full bg-primary text-white" aria-label="Átnevezés mentése">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              </button>
            </form>
          ) : confirming ? (
            <span className="pop-in inline-flex flex-wrap items-center gap-2 rounded-full bg-danger-soft px-3 py-1 text-danger">
              Törlöd a(z) „{current.name}” mappát? A fájlok megmaradnak, az Egyéb közé kerülnek.
              <button type="button" onClick={() => setConfirming(false)} className="font-medium text-muted hover:text-ink">
                Mégse
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => deleteFolderAction(current.id),
                    () => {
                      setConfirming(false);
                      onChange("all");
                      toast({ message: "Mappa törölve – a fájljai az Egyéb között vannak." });
                    },
                  )
                }
                className="font-medium"
              >
                Törlés
              </button>
            </span>
          ) : (
            <>
              <span className="text-muted">„{current.name}” mappa:</span>
              <button type="button" onClick={() => setRenaming(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-muted hover:bg-surface hover:text-ink">
                <Pencil className="size-3.5" /> Átnevezés
              </button>
              <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-muted hover:bg-danger-soft hover:text-danger">
                <Trash2 className="size-3.5" /> Törlés
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
