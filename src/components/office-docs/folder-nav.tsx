"use client";

import { Check, Files, Folder, FolderOpen, Inbox, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition, type DragEvent } from "react";
import { createFolderAction, deleteFolderAction, renameFolderAction } from "@/app/(app)/documents/actions";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { OfficeFolder } from "@/lib/office-docs/data";

/** "all", "none" (files without a folder, "Egyéb") or a folder's id. */
export type FolderPick = "all" | "none" | string;

/** A file dragged from the list carries its id under this type. */
export const DOC_DRAG = "application/x-flavio-document";

export function folderLabel(folders: OfficeFolder[], pick: FolderPick) {
  return pick === "all" ? "Minden fájl" : pick === "none" ? "Egyéb" : (folders.find((f) => f.id === pick)?.name ?? "Mappa");
}

/** Dropping a dragged file on a folder moves it there ("none": out of any folder). */
function useDrop(target: string, onMove: (docId: string, folderId: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props:
      target === "all"
        ? {}
        : {
            onDragOver: (e: DragEvent) => {
              if (!e.dataTransfer.types.includes(DOC_DRAG)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOver(true);
            },
            onDragLeave: () => setOver(false),
            onDrop: (e: DragEvent) => {
              const id = e.dataTransfer.getData(DOC_DRAG);
              setOver(false);
              if (!id) return;
              e.preventDefault();
              e.stopPropagation();
              onMove(id, target === "none" ? "" : target);
            },
          },
  };
}

function NavItem({
  pick,
  label,
  icon: Icon,
  count,
  active,
  onChange,
  onMove,
  layout,
}: {
  pick: FolderPick;
  label: string;
  icon: typeof Folder;
  count: number;
  active: boolean;
  onChange: (v: FolderPick) => void;
  onMove: (docId: string, folderId: string) => void;
  layout: "sidebar" | "chips";
}) {
  const drop = useDrop(pick, onMove);
  if (layout === "chips") {
    return (
      <button
        type="button"
        onClick={() => onChange(pick)}
        aria-pressed={active}
        {...drop.props}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm",
          active ? "border-primary bg-primary font-medium text-white" : "border-border text-muted hover:border-border-strong hover:text-ink",
          drop.over && "border-accent bg-accent-soft text-accent",
        )}
      >
        {label}
        <span className={cn("ml-1.5 text-xs tabular-nums", active ? "text-white/70" : "text-subtle")}>{count}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onChange(pick)}
      aria-current={active ? "true" : undefined}
      {...drop.props}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-surface-strong font-medium text-ink" : "text-muted hover:bg-surface hover:text-ink",
        drop.over && "bg-accent-soft text-accent ring-2 ring-accent/40",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-subtle tabular-nums">{count}</span>
    </button>
  );
}

/** The folders: a sidebar on wide screens, chips on phones. Pick, add, rename, remove; drop files on a folder to move them. */
export function FolderNav({
  folders,
  counts,
  value,
  onChange,
  onMove,
  layout,
}: {
  folders: OfficeFolder[];
  counts: Record<string, number>;
  value: FolderPick;
  onChange: (v: FolderPick) => void;
  onMove: (docId: string, folderId: string) => void;
  layout: "sidebar" | "chips";
}) {
  const [adding, setAdding] = useState(false);
  const [busy, start] = useTransition();

  const items: { pick: FolderPick; label: string; icon: typeof Folder }[] = [
    { pick: "all", label: "Minden fájl", icon: Files },
    ...folders.map((f) => ({ pick: f.id, label: f.name, icon: value === f.id ? FolderOpen : Folder })),
    { pick: "none", label: "Egyéb", icon: Inbox },
  ];

  const addForm = (
    <form
      className={cn("pop-in flex items-center gap-1 border border-ink py-0.5 pr-1 pl-3", layout === "chips" ? "rounded-full" : "rounded-xl")}
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
      <input name="name" autoFocus maxLength={60} placeholder="Mappa neve" aria-label="Új mappa neve" onKeyDown={(e) => e.key === "Escape" && setAdding(false)} className="w-full min-w-0 bg-transparent py-1 text-sm focus:outline-none" />
      <button type="submit" disabled={busy} className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-white" aria-label="Mappa létrehozása">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      </button>
      <button type="button" onClick={() => setAdding(false)} className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:text-ink" aria-label="Mégse">
        <X className="size-3.5" />
      </button>
    </form>
  );

  if (layout === "chips") {
    return (
      <nav aria-label="Mappák" className="flex flex-wrap gap-2">
        {items.map((i) => (
          <NavItem key={i.pick} {...i} count={counts[i.pick] ?? 0} active={value === i.pick} onChange={onChange} onMove={onMove} layout="chips" />
        ))}
        {adding ? (
          addForm
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border-strong px-3.5 py-1.5 text-sm text-muted hover:border-ink hover:text-ink">
            <Plus className="size-3.5" /> Új mappa
          </button>
        )}
      </nav>
    );
  }
  return (
    <nav aria-label="Mappák" className="flex flex-col gap-0.5">
      <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">Mappák</p>
      {items.map((i) => (
        <NavItem key={i.pick} {...i} count={counts[i.pick] ?? 0} active={value === i.pick} onChange={onChange} onMove={onMove} layout="sidebar" />
      ))}
      <div className="mt-1">
        {adding ? (
          addForm
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink">
            <Plus className="size-4" /> Új mappa
          </button>
        )}
      </div>
    </nav>
  );
}

/** Rename or remove the open folder (its creator or a manager). */
export function FolderActions({ folder, onRemoved }: { folder: OfficeFolder; onRemoved: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) =>
    start(async () => {
      const r = await fn().catch(actionFailed);
      if (!r.ok) toast({ message: ("error" in r && r.error) || "Nem sikerült." });
      else after();
    });

  if (!folder.canEdit) return null;
  if (renaming) {
    return (
      <form
        className="pop-in inline-flex items-center gap-1 rounded-full border border-ink py-0.5 pr-1 pl-3"
        onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name") ?? "");
          run(() => renameFolderAction(folder.id, name), () => setRenaming(false));
        }}
      >
        <input name="name" autoFocus defaultValue={folder.name} maxLength={60} aria-label="A mappa új neve" onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} className="w-40 bg-transparent text-sm focus:outline-none" />
        <button type="submit" disabled={busy} className="grid size-7 place-items-center rounded-full bg-primary text-white" aria-label="Átnevezés mentése">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
      </form>
    );
  }
  if (confirming) {
    return (
      <span className="pop-in inline-flex flex-wrap items-center gap-2 rounded-full bg-danger-soft px-3 py-1 text-sm text-danger">
        Törlöd a mappát? A fájlok megmaradnak, az Egyéb közé kerülnek.
        <button type="button" onClick={() => setConfirming(false)} className="font-medium text-muted hover:text-ink">
          Mégse
        </button>
        <button
          type="button"
          disabled={busy}
          className="font-medium"
          onClick={() =>
            run(
              () => deleteFolderAction(folder.id),
              () => {
                setConfirming(false);
                onRemoved();
                toast({ message: "Mappa törölve – a fájljai az Egyéb között vannak." });
              },
            )
          }
        >
          Törlés
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => setRenaming(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-muted hover:bg-surface hover:text-ink">
        <Pencil className="size-3.5" /> Átnevezés
      </button>
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-muted hover:bg-danger-soft hover:text-danger">
        <Trash2 className="size-3.5" /> Törlés
      </button>
    </span>
  );
}
