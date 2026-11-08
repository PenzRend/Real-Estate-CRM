"use client";

import { FilePlus2, Loader2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { generateDocumentAction, templateChoicesAction } from "@/app/(app)/(dokumentumok)/documents/template-actions";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";

type Choice = { id: string; name: string };

/** "Sablonból": pick a template; Flavio writes the document for this record, saves and links it. */
export function GenerateFromTemplate({ kind, id }: { kind: "client" | "property" | "deal"; id: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [making, setMaking] = useState<string | null>(null);
  const [, start] = useTransition();

  function open() {
    dialog.current?.showModal();
    if (!choices) void templateChoicesAction().then(setChoices);
  }

  function make(t: Choice) {
    setMaking(t.id);
    start(async () => {
      const r = await generateDocumentAction(t.id, { kind, id }).catch(actionFailed);
      setMaking(null);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      dialog.current?.close();
      toast({ message: `Elkészült: ${r.title}.` });
    });
  }

  return (
    <>
      <button type="button" onClick={open} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
        <Wand2 className="size-3.5" /> Sablonból
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
        aria-label="Dokumentum készítése sablonból"
      >
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <div>
            <h2 className="text-lg tracking-tight">Dokumentum készítése</h2>
            <p className="mt-1 text-sm text-muted">Válassz sablont: kitöltjük az adatokkal, az AI megírja a bekezdéseket, és elmentjük ide kapcsolva.</p>
          </div>
          {!choices && (
            <p className="flex items-center gap-2 py-3 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Betöltés…
            </p>
          )}
          {choices && !choices.length && (
            <p className="text-sm text-muted">
              Még nincs bekapcsolt sablon.{" "}
              <Link href="/documents/templates" className="font-medium text-ink underline underline-offset-2">
                Sablonok
              </Link>
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {choices?.map((t) => (
              <li key={t.id}>
                <button type="button" disabled={making != null} onClick={() => make(t)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm hover:bg-surface disabled:opacity-60">
                  {making === t.id ? <Loader2 className="size-4 animate-spin text-accent" /> : <FilePlus2 className="size-4 text-accent" />}
                  <span className="flex-1 text-ink">{t.name}</span>
                  {making === t.id && <span className="text-xs text-muted">készül…</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
