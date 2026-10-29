"use client";

import { Check, CircleAlert, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { offerTaskAction, prepareOfferAction, sendOfferAction, type OfferPrep } from "@/app/(app)/matches/offer-actions";
import { MatchCategoryBadge } from "@/components/crm/match-parts";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { MatchCategory } from "@/lib/matching/match";

type Candidate = { id: string; name: string; category: MatchCategory };
type Ready = Extract<OfferPrep, { ok: true }>;
type Item = Candidate & {
  state: "waiting" | "drafting" | "ready" | "failed" | "sending" | "sent" | "task";
  include: boolean;
  draft?: Ready;
  error?: string;
  open?: boolean;
};

/**
 * "Ajánlás mindenkinek": the listing to every matching buyer at once. Flavio
 * writes a personal offer for each (the strong and good matches are ticked),
 * the agent reads and edits them, then one click sends them all from their
 * mailbox. A buyer without an email address gets an "Ajánlani" task instead.
 */
export function BulkOffer({ propertyId, candidates, autoOpen = false }: { propertyId: string; candidates: Candidate[]; autoOpen?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<"pick" | "drafting" | "review" | "sending" | "done">("pick");
  const [senderId, setSenderId] = useState<string | null>(null);

  const reset = () => {
    setItems(candidates.map((c) => ({ ...c, state: "waiting", include: c.category !== "possible" })));
    setPhase("pick");
  };
  const openDialog = () => {
    reset();
    dialog.current?.showModal();
  };

  // A newly added listing opens straight into this, once.
  useEffect(() => {
    if (!autoOpen || !candidates.length) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
    const t = setTimeout(openDialog, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (id: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const chosen = items.filter((i) => i.include);

  async function draftAll() {
    setPhase("drafting");
    for (const item of chosen) {
      patch(item.id, { state: "drafting" });
      const r = await prepareOfferAction(propertyId, item.id).catch(() => ({ ok: false as const, error: "Nem sikerült megírni." }));
      if (r.ok) {
        patch(item.id, { state: "ready", draft: r });
        setSenderId((s) => s ?? r.senders.find((x) => x.canSend)?.id ?? null);
      } else patch(item.id, { state: "failed", error: r.error, include: false });
    }
    setPhase("review");
  }

  async function sendAll() {
    setPhase("sending");
    for (const item of items.filter((i) => i.include && i.state === "ready" && i.draft)) {
      const d = item.draft!;
      patch(item.id, { state: "sending" });
      if (!d.to.trim()) {
        await offerTaskAction(propertyId, item.id).catch(() => undefined);
        patch(item.id, { state: "task" });
        continue;
      }
      const r = await sendOfferAction(propertyId, item.id, { to: d.to, subject: d.subject, body: d.body, mailboxId: senderId }).catch(() => ({ ok: false as const, error: "A küldés nem sikerült." }));
      patch(item.id, r.ok ? { state: "sent" } : { state: "failed", error: "error" in r ? r.error : "A küldés nem sikerült." });
    }
    setPhase("done");
  }

  const senders = items.find((i) => i.draft)?.draft?.senders.filter((s) => s.canSend) ?? [];
  const sendable = items.filter((i) => i.include && i.state === "ready");
  const busy = phase === "drafting" || phase === "sending";

  if (!candidates.length) return null;
  return (
    <>
      <Button size="sm" onClick={openDialog}>
        <Sparkles /> Ajánlás mindenkinek
      </Button>
      <dialog
        ref={dialog}
        onCancel={(e) => busy && e.preventDefault()}
        className="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
        aria-label="Ajánlás az illő ügyfeleknek"
      >
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <h2 className="text-xl">Ajánlás az illő ügyfeleknek</h2>
              <p className="mt-0.5 text-sm text-muted">
                {phase === "pick"
                  ? "Válaszd ki, kinek menjen. Mindenkinek személyre szóló levelet írok, a hirdetés linkjével."
                  : phase === "drafting"
                    ? `Írom az ajánlatokat… ${items.filter((i) => i.state === "ready" || i.state === "failed").length}/${chosen.length}`
                    : phase === "review"
                      ? "Nézd át őket (kattints egy névre a szöveghez), aztán küldd el egyszerre."
                      : phase === "sending"
                        ? "Küldés…"
                        : "Kész. Minden elküldött ajánlat az ügyfél idővonalára került, 2 nap múlva emlékeztetünk az utánkövetésre."}
              </p>
            </div>
            <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink disabled:opacity-40" aria-label="Bezárás">
              <X className="size-4" />
            </button>
          </div>

          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {items.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 px-6 py-3">
                <div className="flex items-center gap-3">
                  {phase === "pick" || (phase === "review" && i.state === "ready") ? (
                    <input type="checkbox" checked={i.include} onChange={(e) => patch(i.id, { include: e.target.checked })} className="size-4 accent-[var(--primary)]" aria-label={`${i.name} kiválasztása`} />
                  ) : (
                    <span className="grid size-4 place-items-center">
                      {i.state === "drafting" || i.state === "sending" ? (
                        <Loader2 className="size-4 animate-spin text-muted" />
                      ) : i.state === "sent" || i.state === "task" ? (
                        <Check className="size-4 text-success" />
                      ) : i.state === "failed" ? (
                        <CircleAlert className="size-4 text-danger" />
                      ) : null}
                    </span>
                  )}
                  <button type="button" disabled={!i.draft} onClick={() => patch(i.id, { open: !i.open })} className="min-w-0 flex-1 text-left">
                    <span className={cn("text-sm font-medium", i.include || phase !== "pick" ? "text-ink" : "text-muted")}>{i.name}</span>
                    <span className="ml-2 text-xs text-muted">
                      {i.state === "sent"
                        ? "elküldve"
                        : i.state === "task"
                          ? "nincs e-mail-címe – feladat lett belőle"
                          : i.state === "failed"
                            ? i.error
                            : i.draft
                              ? i.draft.to || "nincs e-mail-címe – feladat lesz belőle"
                              : ""}
                    </span>
                  </button>
                  <MatchCategoryBadge category={i.category} />
                </div>
                {i.open && i.draft && phase === "review" && (
                  <div className="flex flex-col gap-2 pl-7">
                    <Input value={i.draft.subject} onChange={(e) => patch(i.id, { draft: { ...i.draft!, subject: e.target.value } })} aria-label="Tárgy" className="h-9 text-sm" />
                    <Textarea value={i.draft.body} onChange={(e) => patch(i.id, { draft: { ...i.draft!, body: e.target.value } })} aria-label="Szöveg" className="min-h-48 text-sm" />
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
            {phase === "pick" && (
              <Button onClick={draftAll} disabled={!chosen.length}>
                <Sparkles /> Ajánlatok megírása ({chosen.length})
              </Button>
            )}
            {phase === "drafting" && (
              <Button disabled>
                <Loader2 className="animate-spin" /> Írom…
              </Button>
            )}
            {phase === "review" && (
              <>
                <Button onClick={sendAll} disabled={!sendable.length}>
                  <Send /> Küldés ({sendable.length})
                </Button>
                {senders.length > 1 && (
                  <Select value={senderId ?? ""} onChange={(e) => setSenderId(e.target.value)} aria-label="Küldő" className="h-10 w-auto">
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email}
                      </option>
                    ))}
                  </Select>
                )}
                {!senders.length && <p className="text-xs text-warning">A küldéshez engedélyezd a küldést a Levelek oldalon; addig a levelek feladatként maradnak meg.</p>}
              </>
            )}
            {phase === "sending" && (
              <Button disabled>
                <Loader2 className="animate-spin" /> Küldés…
              </Button>
            )}
            {phase === "done" && <Button onClick={() => dialog.current?.close()}>Kész</Button>}
          </div>
        </div>
      </dialog>
    </>
  );
}
