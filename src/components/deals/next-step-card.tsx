"use client";

import { ArrowRight, CalendarClock, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createContractAction } from "@/app/(app)/(dokumentumok)/contracts/actions";
import { moveDealAction, updateDealFieldAction } from "@/app/(app)/deals/actions";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { NextAction, NextStep } from "@/lib/deals/next-step";

/** Brings a field on the page into view and puts the cursor in it. */
function focusField(selector: string) {
  const box = document.querySelector<HTMLElement>(selector);
  if (!box) return;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  box.classList.add("ring-2", "ring-accent/50", "rounded-xl");
  setTimeout(() => box.classList.remove("ring-2", "ring-accent/50", "rounded-xl"), 1800);
  box.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
}

/** "Következő lépés": what to do now on this deal, with the button that does it. */
export function NextStepCard({ dealId, step, today }: { dealId: string; step: NextStep; today: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  const run = (a: NextAction) => {
    if (a.kind === "fill") return focusField(`[data-deal-field="${a.field}"]`);
    if (a.kind === "offers") return focusField("#offers");
    setBusy(a.label);
    start(async () => {
      if (a.kind === "today") {
        const r = await updateDealFieldAction(dealId, a.field, today).catch(actionFailed);
        if ("error" in r && r.error) toast({ message: r.error });
        else {
          // The date field on the page shows what it was given when it loaded: update it too.
          const input = document.querySelector<HTMLInputElement>(`[data-deal-field="${a.field}"] input`);
          if (input) input.value = today;
        }
      } else if (a.kind === "move") {
        const r = await moveDealAction(dealId, a.stage).catch(actionFailed);
        if ("error" in r && r.error) toast({ message: r.error });
      } else if (a.kind === "contract") {
        const r = await createContractAction(a.contract, { dealId }).catch(actionFailed);
        if (!r.ok) toast({ message: r.error });
        else return router.push(`/contracts/${r.id}`);
      }
      setBusy(null);
    });
  };

  return (
    <section aria-label="Következő lépés" className={cn("reveal flex flex-col gap-3 rounded-3xl border p-5 sm:flex-row sm:items-center", step.waiting ? "border-border bg-surface/60" : "border-accent/30 bg-accent-soft/40")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", step.waiting ? "bg-background text-muted" : "bg-background text-accent")}>
        {step.waiting ? <CalendarClock className="size-5" /> : <Sparkles className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">Következő lépés</p>
        <p className="text-base font-medium text-ink">{step.title}</p>
        {step.detail && <p className="mt-0.5 text-sm text-muted">{step.detail}</p>}
      </div>
      {step.actions.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {step.actions.map((a, i) =>
            a.kind === "link" ? (
              <Link key={a.label} href={a.href} className={buttonClasses(i === 0 ? "primary" : "secondary", "sm")}>
                {a.label} <ArrowRight />
              </Link>
            ) : (
              <button key={a.label} type="button" disabled={busy != null} onClick={() => run(a)} className={buttonClasses(i === 0 ? "primary" : "secondary", "sm")}>
                {busy === a.label && <Loader2 className="animate-spin" />} {a.label}
              </button>
            ),
          )}
        </div>
      )}
    </section>
  );
}
