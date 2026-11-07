"use client";

import { Download, File, FileImage, FileSpreadsheet, FileText, FolderOpen, Loader2, MoreHorizontal, Pin, PinOff, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { addOfficeDocumentAction, deleteOfficeDocumentAction, updateOfficeDocumentAction } from "@/app/(app)/documents/actions";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/i18n/format";
import type { OfficeDocument, OfficeFolder } from "@/lib/office-docs/data";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { FillTemplate } from "./fill-template";
import { FolderBar, type FolderPick } from "./folder-bar";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv";
const MAX_BYTES = 20 * 1024 * 1024;

const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .slice(-120) || "dokumentum";

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

function DocumentRow({ doc, folders }: { doc: OfficeDocument; folders: OfficeFolder[] }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const k = kind(doc);
  const update = (patch: { title?: string; folderId?: string; pinned?: boolean }) => start(() => updateOfficeDocumentAction(doc.id, patch).catch(actionFailed).then(() => undefined));

  return (
    <li className="group relative flex items-center gap-3 px-4 py-3 sm:px-5">
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

/** The office's shared files: folders, search, drag-and-drop upload. */
export function DocumentLibrary({ organizationId, documents, folders }: { organizationId: string; documents: OfficeDocument[]; folders: OfficeFolder[] }) {
  const [picked, setFolder] = useState<FolderPick>("all");
  // A folder that was just removed (by anyone) falls back to "all".
  const folder = picked === "all" || picked === "none" || folders.some((f) => f.id === picked) ? picked : "all";
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: documents.length };
    for (const d of documents) c[d.folderId ?? "none"] = (c[d.folderId ?? "none"] ?? 0) + 1;
    return c;
  }, [documents]);

  const q = query.trim().toLowerCase();
  const shown = documents.filter((d) => (folder === "all" || (d.folderId ?? "none") === folder) && (!q || `${d.title} ${d.fileName} ${d.uploader ?? ""}`.toLowerCase().includes(q)));

  async function upload(files: FileList | File[] | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const supabase = createBrowserSupabase();
    let done = 0;
    for (const file of list) {
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
      const r = await addOfficeDocumentAction({ path, fileName: file.name, size: file.size, mimeType: file.type, folderId: folder === "all" || folder === "none" ? null : folder }).catch(actionFailed);
      if (r.ok) done++;
      else toast({ message: r.error });
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    if (done) toast({ message: done === 1 ? "Feltöltve." : `${done} fájl feltöltve.` });
  }

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void upload(e.dataTransfer.files);
  };

  return (
    <div
      className="flex flex-col gap-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={drop}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés név vagy feltöltő szerint"
            aria-label="Keresés a dokumentumok között"
            className="h-11 w-full rounded-full border border-border bg-background pr-4 pl-10 text-sm focus:border-ink focus:outline-none"
          />
        </label>
        <button type="button" onClick={() => input.current?.click()} disabled={uploading != null} className={buttonClasses("primary", "md", "h-11")}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? "Feltöltés…" : "Feltöltés"}
        </button>
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>

      <FolderBar folders={folders} counts={counts} value={folder} onChange={setFolder} />

      <div className={cn("relative rounded-3xl border bg-background transition-colors", dragging ? "border-accent bg-accent-soft/40" : "border-border")}>
        {uploading && (
          <p className="reveal flex items-center gap-2 border-b border-border px-5 py-3 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Feltöltés: {uploading}
          </p>
        )}
        {shown.length ? (
          <ul className="divide-y divide-border">
            {shown.map((d) => (
              <DocumentRow key={d.id} doc={d} folders={folders} />
            ))}
          </ul>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-surface text-muted">
              <Upload className="size-6" />
            </span>
            <span className="text-sm font-medium text-ink">{documents.length ? "Nincs találat" : "Még nincs közös dokumentum"}</span>
            <span className="max-w-sm text-sm text-muted">
              {documents.length
                ? "Próbálj más keresést vagy mappát."
                : "Húzd ide a fájlokat, vagy kattints: szerződésminták, árlisták, bemutató anyagok – az egész iroda eléri őket."}
            </span>
          </button>
        )}
        {dragging && (
          <div className="pop-in pointer-events-none absolute inset-0 grid place-items-center rounded-3xl bg-accent-soft/80 text-sm font-medium text-accent">
            Engedd el a feltöltéshez{folders.find((f) => f.id === folder) && ` – ${folders.find((f) => f.id === folder)!.name}`}
          </div>
        )}
      </div>
      <p className="text-xs text-subtle">PDF, Word, Excel, PowerPoint, kép vagy szöveg, fájlonként legfeljebb 20 MB. Csak az irodád tagjai látják.</p>
    </div>
  );
}
