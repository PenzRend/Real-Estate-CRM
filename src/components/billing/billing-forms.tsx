"use client";

import { CreditCard } from "lucide-react";
import { useActionState, useState } from "react";
import { checkoutAction, portalAction, type BillingActionState } from "@/app/billing/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/i18n/format";

/** Monthly or yearly, then to Stripe; or, once subscribed, to Stripe's management page. */
export function BillingForms({ priceMonth, priceYear, seats, subscribed, hasCustomer }: { priceMonth: number; priceYear: number; seats: number; subscribed: boolean; hasCustomer: boolean }) {
  const [interval, setPeriod] = useState<"month" | "year">("month");
  const [checkout, startCheckout, paying] = useActionState<BillingActionState, FormData>(checkoutAction, {});
  const [portal, openPortal, opening] = useActionState<BillingActionState, FormData>(portalAction, {});
  const saving = priceMonth * 12 - priceYear;

  return (
    <div className="flex flex-col gap-3">
      {!subscribed && (
        <form action={startCheckout} className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Fizetési időszak" className="grid gap-2 sm:grid-cols-2">
            {(["month", "year"] as const).map((i) => (
              <label
                key={i}
                className={cn("flex cursor-pointer flex-col gap-0.5 rounded-2xl border p-4", interval === i ? "border-ink bg-surface" : "border-border hover:bg-surface")}
              >
                <input type="radio" name="interval" value={i} checked={interval === i} onChange={() => setPeriod(i)} className="sr-only" />
                <span className="text-sm font-medium text-ink">{i === "month" ? "Havi" : "Éves"}</span>
                <span className="text-lg text-ink tabular-nums">
                  {formatNumber(i === "month" ? priceMonth : priceYear)} Ft <span className="text-sm text-muted">/ fő / {i === "month" ? "hó" : "év"}</span>
                </span>
                {i === "year" && saving > 0 && <span className="text-xs text-success">{formatNumber(saving)} Ft megtakarítás fejenként</span>}
              </label>
            ))}
          </div>
          <Button type="submit" size="lg" disabled={paying}>
            <CreditCard className="size-4" />
            {paying ? "Átirányítás…" : `Előfizetek: ${formatNumber((interval === "month" ? priceMonth : priceYear) * seats)} Ft / ${interval === "month" ? "hó" : "év"}`}
          </Button>
          {checkout.error && <p className="text-sm text-danger">{checkout.error}</p>}
        </form>
      )}
      {hasCustomer && (
        <form action={openPortal}>
          <Button type="submit" variant="secondary" disabled={opening}>
            {opening ? "Átirányítás…" : "Előfizetés kezelése (kártya, számlák, lemondás)"}
          </Button>
          {portal.error && <p className="mt-2 text-sm text-danger">{portal.error}</p>}
        </form>
      )}
    </div>
  );
}
