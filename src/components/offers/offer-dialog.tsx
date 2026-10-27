"use client";

import { Check, ClipboardList, Copy, ExternalLink, Loader2, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { offerTaskAction, prepareOfferAction, sendOfferAction, type OfferPrep } from "@/app/(app)/matches/offer-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { gmailComposeUrl } from "@/lib/away/logic";
import { findPlaceholders } from "@/lib/mail/compose";

type Ready = Extract<OfferPrep, { ok: true }>;

/**
 * "Ajánlom": the AI drafts a personal offer to the client with the listing's
 * share link; the agent edits it, then sends it from Gmail, opens it in
 * Gmail, copies it, or just keeps a task. Every way leaves a trace in the CRM.
 */
export function OfferDialog({ propertyId, clientId, onDone, onClose }: { propertyId: string; clientId: string; onDone: (how: "sent" | "task") => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [prep, setPrep] = useState<Ready | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<"send" | "task" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    let cancelled = false;
    prepareOfferAction(propertyId, clientId)
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) return setError(r.error);
        setPrep(r);
        setTo(r.to);
        setSubject(r.subject);
        setBody(r.body);
      })
      .catch(() => !cancelled && setError("Az ajánlat előkészítése nem sikerült. Próbáld újra."));
    return () => {
      cancelled = true;
    };
  }, [propertyId, clientId]);

  const gaps = findPlaceholders(`${subject}\n${body}`);
  const ready = Boolean(to.trim() && subject.trim() && body.trim()) && gaps.length === 0;

  async function send() {
    setBusy("send");
    setError(null);
    const r = await sendOfferAction(propertyId, clientId, { to, subject, body }).catch(() => ({ ok: false as const, error: "A küldés nem sikerült. Próbáld újra." }));
    setBusy(null);
    if (!r.ok) return setError(r.error);
    onDone("sent");
    dialog.current?.close();
  }

  async function keepTask() {
    setBusy("task");
    setError(null);
    const ok = await offerTaskAction(propertyId, clientId).then(
      () => true,
      () => false,
    );
    setBusy(null);
    if (!ok) return setError("A feladatot nem sikerült létrehozni. Próbáld újra.");
    onDone("task");
    dialog.current?.close();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const field = "w-full";
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
      aria-label="Ajánlat küldése"
    >
      <div className="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Ajánlat {prep ? `${prep.clientName} részére` : ""}</h2>
            {prep && <p className="mt-0.5 text-sm text-muted">{prep.propertyTitle}</p>}
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Bezárás" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        {!prep && !error && (
          <p className="flex items-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="size-4 animate-spin text-accent" /> Megírom az ajánlatot az ügyfél keresése alapján, a hirdetés linkjével…
          </p>
        )}

        {prep && (
          <>
            <p className="flex items-center gap-1.5 text-xs text-accent">
              <Sparkles className="size-3.5" /> Az AI írta az ügyfél keresése és az egyezés alapján – ellenőrizd. A link:{" "}
              <a href={prep.link} target="_blank" rel="noopener noreferrer" className="underline">
                hirdetésoldal
              </a>
            </p>
            <Field label="Címzett" htmlFor="offer-to" hint={prep.to ? undefined : "Az ügyfélnek nincs e-mail-címe a CRM-ben."}>
              <Input id="offer-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
            </Field>
            <Field label="Tárgy" htmlFor="offer-subject">
              <Input id="offer-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
            </Field>
            <Field label="Szöveg" htmlFor="offer-body">
              <Textarea id="offer-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-56 leading-relaxed" />
            </Field>
            {gaps.length > 0 && <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">Küldés előtt töltsd ki: {gaps.join(", ")}</p>}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {prep?.mailbox?.canSend ? (
            <Button onClick={send} disabled={!ready || busy != null} title={ready ? undefined : "Add meg a címzettet, és töltsd ki a hiányzó részeket."}>
              {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />} Küldés {prep.mailbox.email && <span className="font-normal opacity-70">({prep.mailbox.email})</span>}
            </Button>
          ) : (
            prep?.mailbox && (
              <a
                href={`/api/mail/google/connect?send=1&next=${encodeURIComponent(pathname)}`}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <ShieldCheck className="size-4" /> Küldés engedélyezése
              </a>
            )
          )}
          {prep && (
            <>
              <a
                href={gmailComposeUrl({ account: prep.mailbox?.email ?? null, to: to.trim() || null, subject, body })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void keepTask()}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface"
              >
                <ExternalLink className="size-4" /> Gmailben
              </a>
              <Button variant="secondary" onClick={copy}>
                {copied ? <Check /> : <Copy />} {copied ? "Másolva" : "Másolás"}
              </Button>
            </>
          )}
          <button type="button" onClick={keepTask} disabled={busy != null} className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-50">
            <ClipboardList className="size-3.5" /> Csak feladat
          </button>
        </div>
        {prep?.mailbox?.canSend && <p className="text-xs text-muted">Küldés után az e-mail az ügyfél idővonalára kerül, és {2} nap múlva emlékeztetünk az utánkövetésre.</p>}
      </div>
    </dialog>
  );
}
