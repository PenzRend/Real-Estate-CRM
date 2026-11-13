"use client";

import { Camera, CheckCircle2, CircleAlert, IdCard, Loader2, MapPinHouse } from "lucide-react";
import { useRef, useState } from "react";
import { scanIdDocumentAction } from "@/app/(app)/clients/aml-actions";
import { actionFailed } from "@/lib/action-failed";
import type { ScanKind, ScannedFields } from "@/lib/aml/scan-fields";
import { cn } from "@/lib/cn";

/** A phone photo shrunk to at most 1600 px on its long side, as JPEG: small enough to send, sharp enough to read. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Puts a value into the identification form's (uncontrolled) field, as if typed. */
function fill(name: string, value: string) {
  const el = document.getElementById(`aml-${name}`) as HTMLInputElement | HTMLSelectElement | null;
  if (!el) return false;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  // Marked until checked: the agent compares it with the document.
  el.classList.add("ring-2", "ring-accent/40");
  return true;
}

const labels: Record<ScanKind, { label: string; hint: string; icon: typeof IdCard }> = {
  identity: { label: "Személyi / útlevél", hint: "Előlap és hátlap (max. 2 fotó)", icon: IdCard },
  address: { label: "Lakcímkártya", hint: "A lakcímes oldal", icon: MapPinHouse },
};

/**
 * Fills the identification form from photos of the ID document and the
 * address card: on a phone it offers the camera or the photo library. The
 * photos are read by the AI and not stored; the agent checks each filled
 * field against the document.
 */
export function IdScan({ clientId }: { clientId: string }) {
  const [busy, setBusy] = useState<ScanKind | null>(null);
  const [result, setResult] = useState<{ kind: ScanKind; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = { identity: useRef<HTMLInputElement>(null), address: useRef<HTMLInputElement>(null) };

  async function scan(kind: ScanKind, files: FileList | null) {
    if (!files?.length) return;
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const images = await Promise.all([...files].slice(0, 2).map(shrink));
      const r = await scanIdDocumentAction(clientId, kind, images).catch(actionFailed);
      if (!r.ok) return setError(r.error);
      const filled = Object.entries(r.fields as ScannedFields).filter(([k, v]) => v && fill(k, String(v)));
      setResult({ kind, count: filled.length });
    } catch {
      setError("A fotót nem sikerült megnyitni. Próbáld újra.");
    } finally {
      setBusy(null);
      if (inputs[kind].current) inputs[kind].current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent-soft/30 p-4 sm:col-span-2">
      <div className="flex items-start gap-2">
        <Camera className="mt-0.5 size-4 shrink-0 text-accent" />
        <div className="text-sm">
          <p className="font-medium text-ink">Kitöltés fotóról</p>
          <p className="text-xs text-muted">Fotózd le az okmányt: az adatok maguktól bekerülnek. A fotót nem tároljuk, csak beolvassuk.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(labels) as ScanKind[]).map((kind) => {
          const { label, hint, icon: Icon } = labels[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => inputs[kind].current?.click()}
              disabled={busy != null}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border border-border-strong bg-background px-3 py-2.5 text-left transition-colors hover:border-ink disabled:opacity-60",
                busy === kind && "border-accent",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                {busy === kind ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />} {label}
              </span>
              <span className="text-xs text-muted">{busy === kind ? "Beolvasás…" : hint}</span>
              <input ref={inputs[kind]} type="file" accept="image/*" multiple={kind === "identity"} className="hidden" onChange={(e) => void scan(kind, e.target.files)} />
            </button>
          );
        })}
      </div>
      {result && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-success">
          <CheckCircle2 className="mt-px size-3.5 shrink-0" />
          {result.count} mezőt kitöltöttem ({labels[result.kind].label}). A kiemelt mezőket vesd össze az okmánnyal.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
          <CircleAlert className="mt-px size-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
