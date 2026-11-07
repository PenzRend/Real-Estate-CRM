"use client";

import { Building, Check, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { chatTargetsAction, shareToChatAction } from "@/app/(app)/messages/actions";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/cn";

type Targets = Awaited<ReturnType<typeof chatTargetsAction>>;

const kindLabel = { client: "ügyfelet", property: "ingatlant", deal: "ügyletet" } as const;

/** "Küldés a csapatnak": sends this client, listing or deal as a card to the office or one colleague, with a note. */
export function ShareToChat({ kind, id, title }: { kind: "client" | "property" | "deal"; id: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [to, setTo] = useState("office");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function openDialog() {
    setSent(null);
    setError(null);
    dialog.current?.showModal();
    if (!targets) void chatTargetsAction().then(setTargets);
  }

  function send() {
    start(async () => {
      const r = await shareToChatAction(to, { kind, id }, note).catch(() => ({ ok: false as const, error: "Nem sikerült elküldeni." }));
      if (r.ok) {
        setSent(to);
        setNote("");
      } else setError(r.error);
    });
  }

  const options = targets ? [{ peer: "office", name: `${targets.office} – mindenki`, avatarUrl: null, office: true }, ...targets.colleagues.map((c) => ({ peer: c.userId, name: c.name, avatarUrl: c.avatarUrl, office: false }))] : [];

  return (
    <>
      <Button variant="secondary" onClick={openDialog} title="Küldés a csapatnak: az iroda csevegésébe vagy egy kollégának">
        <Send /> Csapatnak
      </Button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
        aria-label="Küldés a csapatnak"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg tracking-tight">Küldés a csapatnak</h2>
            <p className="mt-1 text-sm text-muted">
              A(z) {kindLabel[kind]} kártyaként küldjük el: <span className="font-medium text-ink">{title}</span>
            </p>
          </div>

          {sent ? (
            <div className="pop-in flex flex-col items-start gap-3 rounded-2xl bg-success-soft p-4 text-sm text-success">
              <span className="flex items-center gap-2 font-medium">
                <Check className="size-4" /> Elküldve.
              </span>
              <div className="flex gap-2">
                <Link href={`/messages?with=${sent}`} className="font-medium text-ink underline underline-offset-2">
                  Beszélgetés megnyitása
                </Link>
                <button type="button" onClick={() => dialog.current?.close()} className="text-muted hover:text-ink">
                  Bezárás
                </button>
              </div>
            </div>
          ) : (
            <>
              <fieldset className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                <legend className="mb-1 text-xs text-muted">Kinek?</legend>
                {!targets && (
                  <p className="flex items-center gap-2 py-3 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" /> Betöltés…
                  </p>
                )}
                {options.map((o) => (
                  <label key={o.peer} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2", to === o.peer ? "bg-surface-strong" : "hover:bg-surface")}>
                    <input type="radio" name="to" value={o.peer} checked={to === o.peer} onChange={() => setTo(o.peer)} className="sr-only" />
                    {o.office ? (
                      <span className="grid size-7 place-items-center rounded-full bg-accent text-white">
                        <Building className="size-3.5" />
                      </span>
                    ) : (
                      <UserAvatar name={o.name} url={o.avatarUrl} size="sm" />
                    )}
                    <span className="flex-1 truncate text-sm text-ink">{o.name}</span>
                    {to === o.peer && <Check className="size-4 text-accent" />}
                  </label>
                ))}
                {targets && !targets.colleagues.length && <p className="px-3 pt-1 text-xs text-muted">Még nincs kollégád a munkaterületen – meghívni a Beállításokban tudod.</p>}
              </fieldset>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Megjegyzés (nem kötelező), pl. „Van vevőd erre?”"
                aria-label="Megjegyzés"
                className="w-full resize-none rounded-2xl border border-border px-4 py-3 text-sm focus:border-ink focus:outline-none"
              />
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => dialog.current?.close()}>
                  Mégse
                </Button>
                <Button onClick={send} disabled={busy || !targets}>
                  {busy ? <Loader2 className="animate-spin" /> : <Send />} Küldés
                </Button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
