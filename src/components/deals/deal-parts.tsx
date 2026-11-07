"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, Mail, Phone, Plus, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addOfferAction,
  addPartyAction,
  answerOfferAction,
  deleteOfferAction,
  deletePartyAction,
  loseDealAction,
  moveDealAction,
  reopenDealAction,
  type FormState,
} from "@/app/(app)/deals/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/celebrate";
import { Field, Input, Select } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { DealOffer, DealParty } from "@/lib/deals/data";
import { DEAL_STAGES, nextStage, partyRoleLabels, previousStage, stageLabels, type DealStage, type DealStatus } from "@/lib/deals/logic";
import { formatDate, formatPrice } from "@/lib/i18n/format";

/** The stages as steps; the next one is one click away, and any step can be jumped to. */
export function StageBar({ dealId, stage, status }: { dealId: string; stage: DealStage; status: DealStatus }) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<DealStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pending && target ? target : stage;
  const next = nextStage(shown);
  const back = previousStage(shown);
  const go = (s: DealStage) =>
    start(async () => {
      setTarget(s);
      setError(null);
      const r = await moveDealAction(dealId, s).catch(actionFailed);
      if ("error" in r && r.error) setError(r.error);
      else if (s === "closed") celebrate();
    });
  const open = status === "open";

  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {DEAL_STAGES.map((s, i) => {
          const done = DEAL_STAGES.indexOf(shown) > i || status === "won";
          const current = s === shown && open;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!open || pending || s === shown}
                onClick={() => go(s)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-xs transition-colors",
                  current ? "border-primary bg-primary text-white" : done ? "border-success/30 bg-success-soft text-success" : "border-border text-muted hover:border-border-strong hover:text-ink",
                  "disabled:cursor-default",
                )}
              >
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", current ? "bg-white/20" : done ? "bg-success text-white" : "bg-surface")}>
                  {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="truncate font-medium">{stageLabels[s]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {open && (
        <div className="pop-in flex flex-wrap items-center gap-2">
          {back && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => go(back)}>
              <ArrowLeft /> Vissza: {stageLabels[back]}
            </Button>
          )}
          {next && (
            <Button size="sm" disabled={pending} onClick={() => go(next)}>
              {pending ? <Loader2 className="animate-spin" /> : next === "closed" ? <Check /> : <ArrowRight />}
              {next === "closed" ? "Jutalék megérkezett – lezárás" : `Tovább: ${stageLabels[next]}`}
            </Button>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

/** "Meghiúsult": a short reason, or back to running for a closed deal. */
export function DealOutcome({ dealId, status }: { dealId: string; status: DealStatus }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(loseDealAction.bind(null, dealId), {});
  const [reopening, startReopen] = useTransition();
  useEffect(() => {
    if (state.ok) dialog.current?.close();
  }, [state]);

  if (status !== "open") {
    return (
      <Button variant="secondary" disabled={reopening} onClick={() => startReopen(() => reopenDealAction(dealId))}>
        {reopening && <Loader2 className="animate-spin" />} Újranyitás
      </Button>
    );
  }
  return (
    <>
      <Button variant="secondary" onClick={() => dialog.current?.showModal()}>
        <X /> Meghiúsult
      </Button>
      <dialog ref={dialog} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30" aria-label="Ügylet meghiúsult">
        <form action={action} className="flex flex-col gap-4 p-6">
          <h2 className="text-xl">Meghiúsult az ügylet?</h2>
          <p className="text-sm text-muted">Az ingatlan újra aktív lesz (ha nincs rajta másik folyamatban lévő ügylet), a határidős feladatok lezárulnak. Később újranyithatod.</p>
          <Field label="Mi történt? (nem kötelező)" htmlFor="lose-reason">
            <Input id="lose-reason" name="reason" maxLength={500} placeholder="Pl. nem kapott hitelt" />
          </Field>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Meghiúsult
            </Button>
            <Button variant="ghost" onClick={() => dialog.current?.close()}>
              Mégse
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

const offerStatus: Record<DealOffer["status"], { label: string; tone: "neutral" | "success" | "danger" | "warning" }> = {
  open: { label: "Nyitott", tone: "warning" },
  accepted: { label: "Elfogadva", tone: "success" },
  rejected: { label: "Elutasítva", tone: "danger" },
  countered: { label: "Ellenajánlat jött", tone: "neutral" },
};

/** The offers back and forth; accepting one sets the agreed price. */
export function OffersList({ dealId, offers, currency, open }: { dealId: string; offers: DealOffer[]; currency: "HUF" | "EUR"; open: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addOfferAction.bind(null, dealId), {});
  const [busy, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col">
      {offers.length > 0 && (
        <ul className="divide-y divide-border">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  <span className="font-medium tabular-nums">{formatPrice(o.amount, currency)}</span> · {o.madeBy === "buyer" ? "a vevő ajánlata" : "az eladó ellenajánlata"}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(o.madeOn)}
                  {o.note ? ` · ${o.note}` : ""}
                </p>
              </div>
              <Badge tone={offerStatus[o.status].tone}>{offerStatus[o.status].label}</Badge>
              {open && o.status === "open" && (
                <div className="flex gap-1">
                  <Button size="xs" disabled={busy} onClick={() => start(() => answerOfferAction(o.id, "accepted"))}>
                    <Check /> Elfogadva
                  </Button>
                  <Button size="xs" variant="ghost" disabled={busy} onClick={() => start(() => answerOfferAction(o.id, "rejected"))}>
                    Elutasítva
                  </Button>
                </div>
              )}
              <Button size="xs" variant="ghost" aria-label="Ajánlat törlése" disabled={busy} onClick={() => start(() => deleteOfferAction(o.id))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <form ref={form} action={action} className={cn("reveal flex flex-wrap items-end gap-2 px-5 py-4", offers.length > 0 && "border-t border-border")}>
          <div className="w-36">
            <Field label="Összeg" htmlFor="offer-amount">
              <Input id="offer-amount" name="amount" inputMode="decimal" placeholder="78M" required className="h-10" />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Ki tette?" htmlFor="offer-by">
              <Select id="offer-by" name="madeBy" defaultValue={offers[0]?.madeBy === "buyer" ? "seller" : "buyer"} className="h-10">
                <option value="buyer">Vevő</option>
                <option value="seller">Eladó (ellenajánlat)</option>
              </Select>
            </Field>
          </div>
          <div className="min-w-40 flex-1">
            <Field label="Megjegyzés" htmlFor="offer-note">
              <Input id="offer-note" name="note" maxLength={1000} className="h-10" placeholder="Pl. bútorokkal együtt" />
            </Field>
          </div>
          <Button type="submit" size="sm" className="h-10" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} Ajánlat
          </Button>
          {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}

/** Lawyer, bank, mortgage adviser…: one tap to call or write. */
export function PartiesList({ dealId, parties }: { dealId: string; parties: DealParty[] }) {
  const [adding, setAdding] = useState(false);
  // Saved: the form closes (and so starts empty next time).
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await addPartyAction(dealId, prev, form);
    if (r.ok) setAdding(false);
    return r;
  }, {});
  const [busy, start] = useTransition();

  return (
    <div className="flex flex-col">
      {parties.length > 0 && (
        <ul className="divide-y divide-border">
          {parties.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {partyRoleLabels[p.role]}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              {p.phone && (
                <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`${p.name} hívása`}>
                  <Phone className="size-4" />
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`E-mail: ${p.name}`}>
                  <Mail className="size-4" />
                </a>
              )}
              <button type="button" disabled={busy} onClick={() => start(() => deletePartyAction(p.id))} className="grid size-8 place-items-center rounded-full text-subtle hover:bg-surface hover:text-danger" aria-label={`${p.name} eltávolítása`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form action={action} className={cn("grid grid-cols-2 gap-2 px-5 py-4", parties.length > 0 && "border-t border-border")}>
          <Select name="role" defaultValue="lawyer" aria-label="Szerep" className="h-10">
            {Object.entries(partyRoleLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Input name="name" required maxLength={200} placeholder="Név / iroda" aria-label="Név" className="h-10" />
          <Input name="phone" maxLength={50} placeholder="Telefon" aria-label="Telefon" className="h-10" inputMode="tel" />
          <Input name="email" type="email" maxLength={320} placeholder="E-mail" aria-label="E-mail" className="h-10" />
          <Input name="note" maxLength={500} placeholder="Megjegyzés (pl. ügyintéző)" aria-label="Megjegyzés" className="col-span-2 h-10" />
          {state.error && <p className="col-span-2 text-xs text-danger">{state.error}</p>}
          <div className="col-span-2 flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Hozzáadás
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Mégse
            </Button>
          </div>
        </form>
      ) : (
        <div className={cn("px-5 py-3", parties.length > 0 && "border-t border-border")}>
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Szereplő (ügyvéd, bank, hiteltanácsadó…)
          </Button>
        </div>
      )}
    </div>
  );
}
