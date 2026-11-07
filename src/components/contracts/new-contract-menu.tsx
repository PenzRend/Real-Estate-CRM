"use client";

import { FilePlus2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createContractAction } from "@/app/(app)/contracts/actions";
import { RecordSearch } from "@/components/office-docs/record-search";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import type { ContractKind } from "@/lib/contracts/kinds";

type Refs = { dealId?: string | null; propertyId?: string | null; clientId?: string | null };

/** "Új": pick the kind of contract; Flavio drafts it from the data and opens the review screen. A viewing declaration from a listing asks which client. */
export function NewContractMenu({ kinds, refs, from }: { kinds: { kind: ContractKind; label: string; short: string }[]; refs: Refs; from: "deal" | "property" | "client" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<ContractKind | null>(null);
  const [needs, setNeeds] = useState<ContractKind | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  function make(kind: ContractKind, extra: Refs = {}) {
    setBusy(kind);
    start(async () => {
      const r = await createContractAction(kind, { ...refs, ...extra }).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        setBusy(null);
        return;
      }
      router.push(`/contracts/${r.id}`);
    });
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
        <FilePlus2 className="size-3.5" /> Új
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
        aria-label="Új szerződés"
      >
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <div>
            <h2 className="text-lg tracking-tight">Új szerződés</h2>
            <p className="mt-1 text-sm text-muted">Flavio kitölti, amit az adatokból tud (a felek adatait az azonosításukból), az AI megírja a különleges feltételeket – te átnézed és jóváhagyod.</p>
          </div>
          {needs ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink">{from === "property" ? "Melyik ügyfél nézte meg?" : "Melyik ingatlant nézte meg?"}</p>
              <RecordSearch
                only={from === "property" ? "client" : "property"}
                onPick={(r) => {
                  if (from === "property" && r.kind !== "client") return toast({ message: "Ügyfelet válassz." });
                  if (from === "client" && r.kind !== "property") return toast({ message: "Ingatlant válassz." });
                  make(needs, from === "property" ? { clientId: r.id } : { propertyId: r.id });
                }}
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {kinds.map((k) => (
                <li key={k.kind}>
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => (k.kind === "megtekintesi" && !(refs.clientId && refs.propertyId) ? setNeeds(k.kind) : make(k.kind))}
                    className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-surface disabled:opacity-60"
                  >
                    {busy === k.kind ? <Loader2 className="mt-0.5 size-4 animate-spin text-accent" /> : <FilePlus2 className="mt-0.5 size-4 text-accent" />}
                    <span>
                      <span className="block text-sm font-medium text-ink">{k.label}</span>
                      <span className="block text-xs text-muted">{busy === k.kind ? "Készül a tervezet…" : k.short}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}
