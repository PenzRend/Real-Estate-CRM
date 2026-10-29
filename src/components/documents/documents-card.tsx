"use client";

import { Check, CircleDashed, Clock, FileText, Loader2, Mail, Minus, Paperclip, Trash2, Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addDocumentAction, deleteDocumentAction, requestDocumentsAction, setDocumentMarkAction } from "@/app/(app)/properties/document-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import { askable, checklist, progress, type ChecklistItem, type DocumentRow } from "@/lib/documents/checklist";
import { formatDate } from "@/lib/i18n/format";
import { permissionHref } from "@/lib/mail/provider";
import { createBrowserSupabase } from "@/lib/supabase/client";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx";
const MAX_BYTES = 20 * 1024 * 1024;

const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .slice(-120) || "dokumentum";

function Item({ item, propertyId, organizationId }: { item: ChecklistItem; propertyId: string; organizationId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    const supabase = createBrowserSupabase();
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: legfeljebb 20 MB lehet.`);
        continue;
      }
      const path = `${organizationId}/${propertyId}/${item.kind}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (up.error) {
        setError(`${file.name}: a feltöltés nem sikerült (PDF, kép vagy Word lehet).`);
        continue;
      }
      const r = await addDocumentAction(propertyId, { kind: item.kind, path, fileName: file.name, size: file.size }).catch(actionFailed);
      if (!r.ok) setError(r.error);
    }
    setUploading(false);
    if (input.current) input.current.value = "";
  }

  const icon =
    item.status === "done" ? (
      <Check className="size-4 text-success" />
    ) : item.status === "not_needed" ? (
      <Minus className="size-4 text-subtle" />
    ) : item.status === "requested" ? (
      <Clock className="size-4 text-accent" />
    ) : (
      <CircleDashed className={cn("size-4", item.required ? "text-warning" : "text-subtle")} />
    );

  return (
    <li className="flex flex-col gap-1.5 px-5 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className={cn("font-medium", item.status === "not_needed" ? "text-muted line-through" : "text-ink")}>{item.label}</span>
            {item.required && item.status === "missing" && <Badge tone="warning">Kötelező</Badge>}
            {item.status === "requested" && item.requestedAt && <span className="text-xs text-accent">bekérve: {formatDate(item.requestedAt)}</span>}
          </p>
          {item.status === "missing" && <p className="text-xs text-muted">{item.hint}</p>}
          {item.files.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {item.files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-xs">
                  <Paperclip className="size-3.5 shrink-0 text-muted" />
                  {f.url ? (
                    <a href={f.url} className="truncate text-ink underline-offset-2 hover:underline">
                      {f.fileName}
                    </a>
                  ) : (
                    <span className="truncate text-ink">{f.fileName}</span>
                  )}
                  <span className="shrink-0 text-subtle">{formatDate(f.createdAt)}</span>
                  {/* The file itself is deleted, so it takes a second click. */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (confirming === f.id ? start(() => deleteDocumentAction(f.id)) : setConfirming(f.id))}
                    onBlur={() => setConfirming(null)}
                    className={cn("inline-flex shrink-0 items-center gap-1", confirming === f.id ? "font-medium text-danger" : "text-subtle hover:text-danger")}
                    aria-label={confirming === f.id ? `${f.fileName} végleges törlése` : `${f.fileName} törlése`}
                  >
                    <Trash2 className="size-3.5" />
                    {confirming === f.id && "Törlöd?"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => upload(e.target.files)} />
          <Button size="xs" variant={item.status === "done" ? "ghost" : "secondary"} disabled={uploading} onClick={() => input.current?.click()} title="Feltöltés (PDF, kép, Word)">
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            <span className="hidden sm:inline">{item.status === "done" ? "Még egy" : "Feltöltés"}</span>
          </Button>
          {item.status !== "done" && (
            <Button
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={() => start(() => setDocumentMarkAction(propertyId, item.kind, item.status === "not_needed" ? null : "not_needed"))}
              title={item.status === "not_needed" ? "Mégis kell" : "Ennél az ingatlannál nem kell"}
            >
              {item.status === "not_needed" ? "Mégis kell" : "Nem kell"}
            </Button>
          )}
        </div>
      </div>
      {error && <p className="pl-7 text-xs text-danger">{error}</p>}
    </li>
  );
}

/**
 * The listing's paperwork as a checklist: what is there, what is missing,
 * what was asked of the owner. Upload with one click (PDF or a photo of the
 * page); "Hiányzók bekérése" emails the owner a list from the agent's mailbox.
 */
export function DocumentsCard({ propertyId, organizationId, rows, hasOwnerEmail }: { propertyId: string; organizationId: string; rows: DocumentRow[]; hasOwnerEmail: boolean }) {
  const items = checklist(rows);
  const p = progress(items);
  const toAsk = askable(items);
  const [message, setMessage] = useState<{ text: string; ok: boolean; permission?: boolean } | null>(null);
  const [asking, start] = useTransition();
  const pathname = usePathname();

  const ask = () =>
    start(async () => {
      setMessage(null);
      const r = await requestDocumentsAction(propertyId).catch(actionFailed);
      setMessage(r.ok ? { text: `Elküldve – ${r.count} dokumentumot kértem, és 3 nap múlva emlékeztetlek.`, ok: true } : { text: r.error, ok: false, permission: "needsPermission" in r && r.needsPermission });
    });

  return (
    <Card>
      <CardHeader
        title="Dokumentumok"
        action={
          <span className={cn("text-xs font-medium tabular-nums", p.done === p.total ? "text-success" : "text-warning")}>
            {p.done}/{p.total} kötelező megvan
          </span>
        }
      />
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <Item key={i.kind} item={i} propertyId={propertyId} organizationId={organizationId} />
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-border px-5 py-3">
        {toAsk.length > 0 &&
          (hasOwnerEmail ? (
            <Button size="sm" variant="secondary" className="w-fit" onClick={ask} disabled={asking}>
              {asking ? <Loader2 className="animate-spin" /> : <Mail />} Hiányzók bekérése a tulajdonostól ({toAsk.length})
            </Button>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <FileText className="size-3.5" /> Ha a tulajdonosnak van e-mail-címe, egy kattintással bekérheted tőle a hiányzókat.
            </p>
          ))}
        {message && (
          <p className={cn("text-xs", message.ok ? "text-success" : "text-danger")}>
            {message.text}{" "}
            {message.permission && (
              <a href={permissionHref("send", pathname)} className="font-medium underline">
                Küldés engedélyezése
              </a>
            )}
          </p>
        )}
      </div>
    </Card>
  );
}
