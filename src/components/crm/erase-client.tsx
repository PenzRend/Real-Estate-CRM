"use client";

import { Trash2 } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { eraseClientAction } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";

/** "Végleges törlés" for an archived client: the agent types the name to confirm. */
export function EraseClientButton({ clientId, name }: { clientId: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  return (
    <>
      <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => dialog.current?.showModal()}>
        <Trash2 /> Végleges törlés
      </Button>
      <dialog
        ref={dialog}
        onClose={() => {
          setTyped("");
          setError(null);
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-6 text-text shadow-float backdrop:bg-ink/30"
        aria-labelledby={titleId}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!matches) return;
            start(async () => {
              const r = await eraseClientAction(clientId, typed).catch(actionFailed);
              // Success redirects to the client list; only a failure comes back.
              if (r && !r.ok) setError(r.error);
            });
          }}
        >
          <h2 id={titleId} className="text-lg">
            {name} végleges törlése
          </h2>
          <div className="text-sm text-muted">
            <p>Az ügyfél minden adata azonnal és visszavonhatatlanul törlődik a Flavióból:</p>
            <ul className="mt-2 list-disc pl-5 marker:text-subtle">
              <li>adatlap, keresési igények és megjegyzések</li>
              <li>előzmények, feladatok és megtekintések</li>
              <li>a vele váltott levelek másolata, a csapat minden tagjánál</li>
            </ul>
            <p className="mt-2">
              A tulajdonában lévő ingatlanok megmaradnak, tulajdonos nélkül. A közelgő megtekintések a naptáradból is lekerülnek; a postafiókodban (Gmail, Outlook) lévő
              eredeti leveleket ott kell törölni.
            </p>
          </div>
          <Field label={`Megerősítéshez írd be: ${name}`} htmlFor="erase-name">
            <Input id="erase-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </Field>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialog.current?.close()}>
              Mégse
            </Button>
            <Button type="submit" variant="danger" disabled={!matches || busy}>
              {busy ? "Törlés…" : "Végleges törlés"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
