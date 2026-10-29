"use client";

import { CircleAlert, Copy, Check, Loader2, Sparkles, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { saveAdAction, writeAdAction } from "@/app/(app)/properties/ad-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";

const STYLES = [
  { value: "standard", label: "Kiegyensúlyozott" },
  { value: "short", label: "Rövid (portál, közösségi média)" },
  { value: "detailed", label: "Részletes" },
];

/**
 * "AI hirdetésszöveg": Flavio writes the listing's ad from what the CRM knows
 * about it, in the chosen length. The agent edits it, then saves it as the
 * description (optionally with the suggested headline) or copies it.
 */
export function AdWriter({ propertyId, currentTitle }: { propertyId: string; currentTitle: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [style, setStyle] = useState("standard");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [useTitle, setUseTitle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [writing, startWrite] = useTransition();
  const [saving, startSave] = useTransition();

  const write = () =>
    startWrite(async () => {
      setError(null);
      const r = await writeAdAction(propertyId, style).catch(actionFailed);
      if (!r.ok) return setError(r.error);
      setTitle(r.title);
      setText(r.description);
      setMissing(r.missing);
    });

  const save = () =>
    startSave(async () => {
      const r = await saveAdAction(propertyId, text, useTitle ? title : null).catch(actionFailed);
      if (r.ok) dialog.current?.close();
      else setError(r.error);
    });

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          dialog.current?.showModal();
          if (!text && !writing) write();
        }}
      >
        <Sparkles /> AI hirdetésszöveg
      </Button>
      <dialog ref={dialog} className="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30" aria-label="AI hirdetésszöveg">
        <div className="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl">Hirdetésszöveg</h2>
              <p className="mt-0.5 text-sm text-muted">Az ingatlan adataiból írom – csak abból, ami a Flavióban szerepel. Nézd át, és mentsd a leírásba.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Bezárás">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Stílus" className="h-10 w-auto">
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" onClick={write} disabled={writing}>
              {writing ? <Loader2 className="animate-spin" /> : <Sparkles />} {text ? "Újraírás" : "Megírás"}
            </Button>
          </div>
          {writing && !text && (
            <p className="flex items-center gap-2 py-8 text-sm text-muted">
              <Loader2 className="size-4 animate-spin text-accent" /> Írom a hirdetést az ingatlan adataiból…
            </p>
          )}
          {text && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs font-medium text-muted">
                  <input type="checkbox" checked={useTitle} onChange={(e) => setUseTitle(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                  Az ingatlan címe is ez legyen (most: „{currentTitle}”)
                </label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Cím" />
              </div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Hirdetésszöveg" className="min-h-72 leading-relaxed" />
              {missing.length > 0 && (
                <p className="flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> A vevők ezt is keresni fogják, de nincs megadva: {missing.join(", ")}. Az energetikai besorolást a hirdetésben kötelező feltüntetni.
                </p>
              )}
            </>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          {text && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving || writing}>
                {saving ? <Loader2 className="animate-spin" /> : <Check />} Mentés a leírásba
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  navigator.clipboard.writeText(`${title}\n\n${text}`).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                }
              >
                {copied ? <Check /> : <Copy />} {copied ? "Másolva" : "Másolás a portálhoz"}
              </Button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
