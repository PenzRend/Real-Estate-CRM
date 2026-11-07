"use client";

import { Loader2, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { suggestFoldersAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import type { OfficeFolder } from "@/lib/office-docs/data";

export type PlannedUpload = { file: File; title: string; folderId: string | null };

const titleOf = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " ").trim() || "Dokumentum";

/**
 * Before files go up: a name and a folder for each. In a folder, files go
 * there; in "Minden fájl" the AI suggests a folder per file (changeable).
 */
export function UploadDialog({
  files,
  folders,
  defaultFolder,
  onCancel,
  onConfirm,
}: {
  files: File[];
  folders: OfficeFolder[];
  /** The open folder; null in "Minden fájl" / "Egyéb". */
  defaultFolder: string | null;
  onCancel: () => void;
  onConfirm: (plan: PlannedUpload[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<PlannedUpload[]>(() => files.map((file) => ({ file, title: titleOf(file.name), folderId: defaultFolder })));
  const [suggesting, setSuggesting] = useState(defaultFolder == null && folders.length > 0);
  const [suggested, setSuggested] = useState<Set<number>>(new Set());

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // Outside a folder, ask where each file belongs.
  useEffect(() => {
    if (defaultFolder != null || !folders.length) return;
    let live = true;
    void suggestFoldersAction(files.map((f) => f.name))
      .then((byName) => {
        if (!live) return;
        setPlan((p) => p.map((x) => (byName[x.file.name] ? { ...x, folderId: byName[x.file.name] } : x)));
        setSuggested(new Set(files.map((f, i) => (byName[f.name] ? i : -1)).filter((i) => i >= 0)));
      })
      .finally(() => live && setSuggesting(false));
    return () => {
      live = false;
    };
  }, [files, folders, defaultFolder]);

  const set = (i: number, patch: Partial<PlannedUpload>) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <dialog
      ref={dialog}
      onClose={onCancel}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
      aria-label="Feltöltés"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg tracking-tight">{files.length === 1 ? "Egy fájl feltöltése" : `${files.length} fájl feltöltése`}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            {suggesting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Az AI keresi, melyik mappába valók…
              </>
            ) : suggested.size ? (
              <>
                <Sparkles className="size-3.5 text-accent" /> A mappákat az AI javasolta – nyugodtan módosítsd.
              </>
            ) : (
              "Adj nevet, és válaszd ki a mappát."
            )}
          </p>
        </div>
        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {plan.map((p, i) => (
            <li key={`${p.file.name}-${i}`} className="grid grid-cols-1 gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-[1fr_12rem]">
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
                Név
                <input
                  value={p.title}
                  onChange={(e) => set(i, { title: e.target.value })}
                  maxLength={200}
                  className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-ink focus:border-ink focus:outline-none"
                />
                <span className="truncate text-[11px] text-subtle">{p.file.name}</span>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                <span className="flex items-center gap-1">
                  Mappa {suggested.has(i) && <Sparkles className="size-3 text-accent" aria-label="AI-javaslat" />}
                </span>
                <select
                  value={p.folderId ?? ""}
                  onChange={(e) => {
                    set(i, { folderId: e.target.value || null });
                    setSuggested((s) => new Set([...s].filter((x) => x !== i)));
                  }}
                  className="h-9 rounded-xl border border-border bg-background px-2 text-sm text-ink"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                  <option value="">Egyéb (mappa nélkül)</option>
                </select>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            Mégse
          </Button>
          <Button
            onClick={() => {
              onConfirm(plan);
              dialog.current?.close();
            }}
          >
            <Upload /> Feltöltés
          </Button>
        </div>
      </div>
    </dialog>
  );
}
