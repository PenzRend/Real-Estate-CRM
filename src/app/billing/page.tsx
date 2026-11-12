import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/app-shell/logo";
import { BillingForms } from "@/components/billing/billing-forms";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { daysLeft, hasAccess, statusLabels } from "@/lib/billing/access";
import { getPlan, memberCount, workspaceBilling } from "@/lib/billing/data";
import { formatDate, formatNumber } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Előfizetés", robots: { index: false } };

const INCLUDED = [
  "Diktálásból ügyféladat és teendő",
  "Ingatlan–ügyfél párosítás indoklással",
  "Gmail- és Outlook-összekapcsolás, válaszvázlatok",
  "Forrásokkal válaszoló AI-asszisztens",
  "Hirdetésimport, megosztható adatlapok, naptár",
  "Csapat: közös ügyfelek és ingatlanok",
];

async function BillingContent({ searchParams }: { searchParams: PageProps<"/billing">["searchParams"] }) {
  const user = await getCurrentUser();
  const [billing, plan, seats, params] = await Promise.all([workspaceBilling(user), getPlan(), memberCount(user.organization.id), searchParams]);
  const access = hasAccess(billing);
  const canPay = user.organization.role !== "member";
  const paid = params.fizetve === "1";

  const status = (() => {
    switch (billing.status) {
      case "pilot":
        return "A pilot idejére ingyenesen használod a Flaviót. Ha ez véget ér, előre szólunk.";
      case "trialing":
        return access
          ? `Még ${daysLeft(billing.trialEndsAt)} napig ingyenesen használod (${formatDate(billing.trialEndsAt)}-ig). Utána előfizetéssel folytathatod; az adataid megmaradnak.`
          : "Az ingyenes próbaidő lejárt. Az adataid megvannak: előfizetéssel ott folytathatod, ahol abbahagytad.";
      case "active":
        return billing.cancelAtPeriodEnd
          ? `Az előfizetés ${formatDate(billing.currentPeriodEnd)}-ig tart, utána nem újul meg.`
          : `Az előfizetés aktív, a következő fordulónap: ${formatDate(billing.currentPeriodEnd)}.`;
      case "past_due":
        return "Az utolsó fizetés nem sikerült. Frissítsd a kártyát az Előfizetés kezelése gombbal, különben pár nap múlva szünetel a hozzáférés.";
      case "canceled":
        return access ? `Lemondtad; ${formatDate(billing.currentPeriodEnd)}-ig még használhatod.` : "Az előfizetés véget ért. Az adataid megvannak: előfizetéssel folytathatod.";
      default:
        return "A Flavio használatához válassz előfizetést. Ha meghívókódod van, a regisztrációkor adtad volna meg; írj nekünk, és megoldjuk.";
    }
  })();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-muted">{user.organization.name}</p>
        <h1 className="mt-1 text-[28px] leading-tight sm:text-[34px]">Előfizetés</h1>
      </div>

      {paid && (
        <p role="status" className="rounded-2xl bg-success-soft p-4 text-sm text-success">
          Köszönjük! A fizetés megérkezett; az előfizetés pár másodpercen belül aktív lesz. Ha még nem látod, frissítsd az oldalt.
        </p>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-border p-5">
        <p className="text-sm font-medium text-ink">{statusLabels[billing.status]}</p>
        <p className="text-sm text-muted">{status}</p>
        {access && (
          <Link href="/dashboard" className="mt-1 text-sm font-medium text-ink underline-offset-4 hover:underline">
            Tovább a Flavióba →
          </Link>
        )}
      </section>

      {plan && (
        <section className="flex flex-col gap-5 rounded-2xl border border-border p-5">
          <div>
            <h2 className="text-lg">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Ingatlanosonként (a munkaterület minden tagja egy hely). Most {seats} fő: havonta {formatNumber(plan.priceMonth * seats)} Ft, vagy évente {formatNumber(plan.priceYear * seats)} Ft.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-ink">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> AI: {formatNumber(plan.aiDailyPerSeat)} hívás naponta
              {plan.aiMonthlyPerSeat !== null && `, ${formatNumber(plan.aiMonthlyPerSeat)} havonta`} fejenként
            </li>
          </ul>
          {canPay ? (
            <BillingForms
              priceMonth={plan.priceMonth}
              priceYear={plan.priceYear}
              seats={seats}
              subscribed={billing.status === "active" || billing.status === "past_due" || (billing.status === "canceled" && access)}
              hasCustomer={!!billing.stripeCustomerId}
            />
          ) : (
            <p className="text-sm text-muted">Az előfizetést a munkaterület tulajdonosa vagy egy admin intézi.</p>
          )}
          <p className="text-xs text-muted">
            A fizetés a Stripe biztonságos oldalán történik; kártyaadat nálunk nem fordul meg. Az árak végösszegek (alanyi adómentes), a számlát e-mailben küldjük. Bármikor lemondhatod, a
            kifizetett időszak végéig használhatod.
          </p>
        </section>
      )}
    </div>
  );
}

export default function BillingPage({ searchParams }: PageProps<"/billing">) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <Logo />
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-muted hover:text-ink">
              Kijelentkezés
            </button>
          </form>
        </div>
        <PageSuspense>
          <BillingContent searchParams={searchParams} />
        </PageSuspense>
      </div>
    </div>
  );
}
