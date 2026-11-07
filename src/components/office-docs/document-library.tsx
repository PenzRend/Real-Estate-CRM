"use client";

import { ChevronRight, Download, File, FileImage, FileSpreadsheet, FileText, Folder, FolderOpen, GripVertical, Loader2, MoreHorizontal, Pin, PinOff, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { addOfficeDocumentAction, deleteOfficeDocumentAction, updateOfficeDocumentAction } from "@/app/(app)/documents/actions";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/i18n/format";
import type { OfficeDocument, OfficeFolder } from "@/lib/office-docs/data";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { DocLinks } from "./doc-links";
import { FillTemplate } from "./fill-template";
import { DOC_DRAG, FolderActions, FolderNav, folderLabel, type FolderPick } from "./folder-nav";
import { UploadDialog, type PlannedUpload } from "./upload-dialog";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv";
const MAX_BYTES = 20 * 1024 * 1024;

const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .slice(-120) || "dokumentum";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** An icon and colour by file type, so a list of files reads at a glance. */
function kind(d: OfficeDocument) {
  const n = d.fileName.toLowerCase();
  if (n.endsWith(".pdf")) return { Icon: FileText, cls: "bg-danger-soft text-danger", label: "PDF" };
  if (/\.docx?$/.test(n)) return { Icon: FileText, cls: "bg-accent-soft text-accent", label: "Word" };
  if (n.endsWith(".pptx")) return { Icon: FileImage, cls: "bg-warning-soft text-warning", label: "Bemutató" };
  if (n.endsWith(".txt")) return { Icon: FileText, cls: "bg-surface-strong text-muted", label: "Szöveg" };
  if (/\.(xlsx?|csv)$/.test(n)) return { Icon: FileSpreadsheet, cls: "bg-success-soft text-success", label: "Táblázat" };
  if (/\.(jpe?g|png|webp|heic)$/.test(n)) return { Icon: FileImage, cls: "bg-warning-soft text-warning", label: "Kép" };
  return { Icon: File, cls: "bg-surface-strong text-muted", label: "Fájl" };
}

function DocumentRow({ doc, folders, highlighted = false }: { doc: OfficeDocument; folders: OfficeFolder[]; highlighted?: boolean }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const k = kind(doc);
  const update = (patch: { title?: string; folderId?: string; pinned?: boolean }) => start(() => updateOfficeDocumentAction(doc.id, patch).catch(actionFailed).then(() => undefined));
  const row = useRef<HTMLLIElement>(null);
  // Opened from a link (e.g. the assistant): bring it into view.
  useEffect(() => {
    if (highlighted) row.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlighted]);

  return (
    <li
      ref={row}
      draggable={doc.canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData(DOC_DRAG, doc.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn("group relative flex items-center gap-3 px-4 py-3 sm:px-5", highlighted && "bg-accent-soft/60 ring-2 ring-accent/40 ring-inset")}
    >
      {doc.canEdit && <GripVertical className="absolute left-0.5 hidden size-3.5 cursor-grab text-subtle opacity-0 transition-opacity group-hover:opacity-100 sm:block" aria-hidden />}
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", k.cls)}>
        <k.Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get("title");
              update({ title: String(v ?? "") });
              setRenaming(false);
            }}
          >
            <input
              name="title"
              defaultValue={doc.title}
              autoFocus
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
              maxLength={200}
              aria-label="Új név"
              className="w-full rounded-lg border border-border px-2 py-1 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </form>
        ) : (
          <a href={doc.url ?? undefined} className="flex items-center gap-1.5 truncate text-sm font-medium text-ink hover:text-accent">
            {doc.pinned && <Pin className="size-3.5 shrink-0 text-accent" aria-label="Kitűzve" />}
            <span className="truncate">{doc.title}</span>
          </a>
        )}
        <p className="mt-0.5 truncate text-xs text-muted">
          {k.label} · {size(doc.sizeBytes)} · {folders.find((f) => f.id === doc.folderId)?.name ?? "Egyéb"} · {doc.uploader ? `${doc.uploader}, ` : ""}
          {formatDate(doc.createdAt)}
        </p>
        <DocLinks documentId={doc.id} links={doc.links} canEdit={doc.canEdit} />
      </div>
      {busy && <Loader2 className="size-4 animate-spin text-subtle" />}
      {/\.docx$/i.test(doc.fileName) && <FillTemplate documentId={doc.id} title={doc.title} />}
      {doc.url && (
        <a href={doc.url} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`${doc.title} letöltése`} title="Letöltés">
          <Download className="size-4" />
        </a>
      )}
      {doc.canEdit && (
        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Továbbiak">
            <MoreHorizontal className="size-4" />
          </button>
          <div
            className={cn("menu-motion absolute right-0 z-30 mt-1 flex w-56 flex-col gap-0.5 rounded-2xl border border-border bg-background p-1.5 text-sm shadow-float", !menu && "hidden")}
            onMouseLeave={() => setMenu(false)}
          >
            <button type="button" className="rounded-xl px-3 py-2 text-left hover:bg-surface" onClick={() => (setMenu(false), setRenaming(true))}>
              Átnevezés
            </button>
            <button type="button" className="flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-surface" onClick={() => (setMenu(false), update({ pinned: !doc.pinned }))}>
              {doc.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {doc.pinned ? "Kitűzés levétele" : "Kitűzés felülre"}
            </button>
            <label className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 hover:bg-surface">
              <span className="flex items-center gap-2">
                <FolderOpen className="size-4" /> Mappa
              </span>
              <select
                value={doc.folderId ?? ""}
                onChange={(e) => (setMenu(false), update({ folderId: e.target.value }))}
                className="max-w-28 rounded-lg border border-border bg-background px-1.5 py-1 text-xs"
                aria-label="Mappa"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
                <option value="">Egyéb</option>
              </select>
            </label>
            <button type="button" className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-danger hover:bg-danger-soft" onClick={() => (setMenu(false), setConfirming(true))}>
              <Trash2 className="size-4" /> Törlés
            </button>
          </div>
        </div>
      )}
      {confirming && (
        <div className="pop-in absolute inset-0 z-20 flex items-center justify-between gap-3 rounded-2xl bg-danger-soft px-4 sm:px-5">
          <p className="truncate text-sm text-danger">Törlöd: „{doc.title}”? Ez nem vonható vissza.</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={buttonClasses("ghost", "xs")}>
              Mégse
            </button>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  await deleteOfficeDocumentAction(doc.id).catch(actionFailed);
                  toast({ message: "Dokumentum törölve." });
                })
              }
              className={buttonClasses("danger", "xs")}
            >
              Törlés
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** The office's shared files as an explorer: folders on the side, the open folder's files, search, drag-and-drop. */
export function DocumentLibrary({
  organizationId,
  documents,
  folders,
  initialFolder = "all",
  highlight = null,
}: {
  organizationId: string;
  documents: OfficeDocument[];
  folders: OfficeFolder[];
  initialFolder?: FolderPick;
  /** A document to show and point at (a link from the assistant or elsewhere). */
  highlight?: string | null;
}) {
  const [picked, setFolder] = useState<FolderPick>(initialFolder);
  // A folder that was just removed (by anyone) falls back to "all".
  const folder = picked === "all" || picked === "none" || folders.some((f) => f.id === picked) ? picked : "all";
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<File[] | null>(null);
  const [, startMove] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const current = folders.find((f) => f.id === folder) ?? null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: documents.length };
    for (const d of documents) c[d.folderId ?? "none"] = (c[d.folderId ?? "none"] ?? 0) + 1;
    return c;
  }, [documents]);

  const q = fold(query.trim());
  // A search looks through every folder.
  const shown = documents.filter((d) => (q ? fold(`${d.title} ${d.fileName} ${d.uploader ?? ""} ${folderLabel(folders, d.folderId ?? "none")} ${d.links.map((l) => l.title).join(" ")}`).includes(q) : folder === "all" || (d.folderId ?? "none") === folder));

  const move = (docId: string, folderId: string) =>
    startMove(async () => {
      await updateOfficeDocumentAction(docId, { folderId }).catch(actionFailed);
      toast({ message: `Áthelyezve: ${folderId ? folderLabel(folders, folderId) : "Egyéb"}.` });
    });

  async function upload(plan: PlannedUpload[]) {
    const supabase = createBrowserSupabase();
    let done = 0;
    for (const { file, title, folderId, links } of plan) {
      if (file.size > MAX_BYTES) {
        toast({ message: `${file.name}: legfeljebb 20 MB lehet.` });
        continue;
      }
      setUploading(file.name);
      const path = `${organizationId}/office/${crypto.randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (up.error) {
        toast({ message: `${file.name}: a feltöltés nem sikerült (PDF, Word, Excel, kép vagy szöveg lehet).` });
        continue;
      }
      const r = await addOfficeDocumentAction({ path, fileName: file.name, size: file.size, mimeType: file.type, folderId, title, links }).catch(actionFailed);
      if (r.ok) done++;
      else toast({ message: r.error });
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    if (done) toast({ message: done === 1 ? "Feltöltve." : `${done} fájl feltöltve.` });
  }

  const choose = (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (list.length) setPending(list);
  };

  const drop = (e: DragEvent) => {
    setDragging(false);
    if (e.dataTransfer.types.includes(DOC_DRAG)) return; // a file moved inside the list, not an upload
    e.preventDefault();
    choose(e.dataTransfer.files);
  };

  const folderTiles = folder === "all" && !q && folders.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[14rem_1fr]">
      <aside className="hidden md:block">
        <div className="sticky top-6">
          <FolderNav folders={folders} counts={counts} value={folder} onChange={setFolder} onMove={move} layout="sidebar" />
        </div>
      </aside>

      <div
        className="flex min-w-0 flex-col gap-4"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DOC_DRAG)) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
        onDrop={drop}
      >
        <div className="md:hidden">
          <FolderNav folders={folders} counts={counts} value={folder} onChange={setFolder} onMove={move} layout="chips" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés az összes mappában: név, ügyfél, ingatlan, feltöltő"
              aria-label="Keresés a dokumentumok között"
              className="h-11 w-full rounded-full border border-border bg-background pr-4 pl-10 text-sm focus:border-ink focus:outline-none"
            />
          </label>
          <button type="button" onClick={() => input.current?.click()} disabled={uploading != null} className={buttonClasses("primary", "md", "h-11")}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? "Feltöltés…" : current ? `Feltöltés ide` : "Feltöltés"}
          </button>
          <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => choose(e.target.files)} />
        </div>

        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <nav aria-label="Hely" className="flex min-w-0 items-center gap-1.5 text-sm">
            <button type="button" onClick={() => setFolder("all")} className="text-muted hover:text-ink">
              Dokumentumok
            </button>
            {(folder !== "all" || q) && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-subtle" />
                <span className="truncate font-medium text-ink">{q ? `Keresés: „${query.trim()}”` : folderLabel(folders, folder)}</span>
              </>
            )}
            <span className="text-xs text-subtle">· {shown.length} fájl</span>
          </nav>
          {current && !q && <FolderActions key={current.id} folder={current} onRemoved={() => setFolder("all")} />}
        </div>

        {folderTiles && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {folders.map((f) => (
              <li key={f.id}>
                <FolderTile folder={f} count={counts[f.id] ?? 0} onOpen={() => setFolder(f.id)} onMove={move} />
              </li>
            ))}
          </ul>
        )}

        <div className={cn("relative rounded-3xl border bg-background transition-colors", dragging ? "border-accent bg-accent-soft/40" : "border-border")}>
          {folderTiles && shown.length > 0 && <p className="border-b border-border px-5 py-3 text-xs font-medium tracking-wide text-subtle uppercase">Legutóbbi fájlok</p>}
          {uploading && (
            <p className="reveal flex items-center gap-2 border-b border-border px-5 py-3 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Feltöltés: {uploading}
            </p>
          )}
          {shown.length ? (
            <ul className="divide-y divide-border">
              {(folderTiles ? shown.slice(0, 12) : shown).map((d) => (
                <DocumentRow key={d.id} doc={d} folders={folders} highlighted={d.id === highlight} />
              ))}
            </ul>
          ) : (
            <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-surface text-muted">
                <Upload className="size-6" />
              </span>
              <span className="text-sm font-medium text-ink">{q ? "Nincs találat" : documents.length ? "Ez a mappa üres" : "Még nincs közös dokumentum"}</span>
              <span className="max-w-sm text-sm text-muted">
                {q
                  ? "Próbálj más szót – a keresés minden mappában néz."
                  : "Húzd ide a fájlokat, vagy kattints: szerződésminták, árlisták, bemutató anyagok – az egész iroda eléri őket."}
              </span>
            </button>
          )}
          {dragging && (
            <div className="pop-in pointer-events-none absolute inset-0 grid place-items-center rounded-3xl bg-accent-soft/80 text-sm font-medium text-accent">
              Engedd el a feltöltéshez{current && ` – ${current.name}`}
            </div>
          )}
        </div>
        <p className="text-xs text-subtle">
          PDF, Word, Excel, PowerPoint, kép vagy szöveg, fájlonként legfeljebb 20 MB. Egy fájlt a mappájára húzva áthelyezhetsz. Csak az irodád tagjai látják.
        </p>
      </div>

      {pending && (
        <UploadDialog
          files={pending}
          folders={folders}
          defaultFolder={current?.id ?? null}
          onCancel={() => setPending(null)}
          onConfirm={(plan) => {
            setPending(null);
            void upload(plan);
          }}
        />
      )}
    </div>
  );
}

/** A folder on the "Minden fájl" view: opens on click, takes files dropped on it. */
function FolderTile({ folder, count, onOpen, onMove }: { folder: OfficeFolder; count: number; onOpen: () => void; onMove: (docId: string, folderId: string) => void }) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DOC_DRAG)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(DOC_DRAG);
        setOver(false);
        if (id) {
          e.preventDefault();
          e.stopPropagation();
          onMove(id, folder.id);
        }
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border bg-background p-4 text-left transition-colors hover:border-border-strong",
        over ? "border-accent bg-accent-soft ring-2 ring-accent/30" : "border-border",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
        <Folder className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{folder.name}</span>
        <span className="block text-xs text-muted">{count} fájl</span>
      </span>
    </button>
  );
}
