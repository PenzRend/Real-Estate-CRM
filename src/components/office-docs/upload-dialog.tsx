"use client";

import { Link2, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { suggestFoldersAction, suggestLinksAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import type { OfficeFolder } from "@/lib/office-docs/data";
import { RecordSearch, recordIcons } from "./record-search";

type PlannedLink = { kind: "client" | "property" | "deal"; id: string; title: string; source: "manual" | "ai" };
export type PlannedUpload = { file: File; title: string; folderId: string | null; links: PlannedLink[] };

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
  const [plan, setPlan] = useState<PlannedUpload[]>(() => files.map((file) => ({ file, title: titleOf(file.name), folderId: defaultFolder, links: [] })));
  const [suggesting, setSuggesting] = useState(defaultFolder == null && folders.length > 0);
  const [suggested, setSuggested] = useState<Set<number>>(new Set());
  const [linking, setLinking] = useState(true);
  const [picking, setPicking] = useState<number | null>(null);

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

  // Which clients, listings or deals each file is about (AI, from the names).
  useEffect(() => {
    let live = true;
    void suggestLinksAction(files.map((f) => f.name))
      .then((byName) => {
        if (!live) return;
        setPlan((p) =>
          p.map((x) => {
            const found = (byName[x.file.name] ?? []).map((l) => ({ kind: l.kind, id: l.id, title: l.title, source: "ai" as const }));
            return found.length ? { ...x, links: [...x.links, ...found.filter((f) => !x.links.some((l) => l.id === f.id))] } : x;
          }),
        );
      })
      .catch(() => {})
      .finally(() => live && setLinking(false));
    return () => {
      live = false;
    };
  }, [files]);

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
              <div className="relative flex flex-wrap items-center gap-1.5 sm:col-span-2">
                <span className="text-xs text-muted">Kapcsolódik:</span>
                {p.links.map((l) => {
                  const Icon = recordIcons[l.kind];
                  return (
                    <span key={`${l.kind}-${l.id}`} className="pop-in inline-flex items-center gap-1 rounded-full bg-background py-0.5 pr-1 pl-2 text-xs text-ink">
                      <Icon className="size-3 text-accent" />
                      <span className="max-w-40 truncate">{l.title}</span>
                      {l.source === "ai" && <Sparkles className="size-3 text-accent" aria-label="AI-javaslat" />}
                      <button type="button" onClick={() => set(i, { links: p.links.filter((x) => x !== l) })} className="grid size-4 place-items-center rounded-full text-subtle hover:text-danger" aria-label={`${l.title} elvetése`}>
                        <X className="size-3" />
                      </button>
                    </span>
                  );
                })}
                {linking && !p.links.length && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Loader2 className="size-3 animate-spin" /> keresem…
                  </span>
                )}
                <button type="button" onClick={() => setPicking(picking === i ? null : i)} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted hover:bg-background hover:text-ink">
                  <Link2 className="size-3" /> Ügyfél, ingatlan, ügylet
                </button>
                {picking === i && (
                  <div className="pop-in absolute top-full left-0 z-30 mt-1 w-80 max-w-full rounded-2xl border border-border bg-background p-2 shadow-float [--pop-from:-4px]">
                    <RecordSearch
                      onClose={() => setPicking(null)}
                      onPick={(r) => {
                        setPicking(null);
                        if (!p.links.some((l) => l.id === r.id)) set(i, { links: [...p.links, { kind: r.kind, id: r.id, title: r.title, source: "manual" }] });
                      }}
                    />
                  </div>
                )}
              </div>
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
