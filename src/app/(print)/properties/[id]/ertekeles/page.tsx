import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/listings/print-button";
import { getCurrentUser } from "@/lib/auth";
import { formatArea, formatDate, formatNumber, formatPrice } from "@/lib/i18n/format";
import { propertyTypeLabels } from "@/lib/i18n/labels";
import { priceStudy } from "@/lib/listings/comparables";
import { db } from "@/lib/supabase/db";

// The valuation sheet for the owner meeting: the property, comparable
// properties the office knows (agreed prices first), and a price range. Made
// to be printed or saved as a PDF; no app chrome.

export const metadata: Metadata = { title: "Értékbecslő lap", robots: { index: false, follow: false } };

async function Sheet({ params }: Pick<PageProps<"/properties/[id]/ertekeles">, "params">) {
  await connection();
  const { id } = await params;
  const user = await getCurrentUser();
  const study = await priceStudy(user, id);
  if (!study) notFound();
  const supabase = await db();
  const { data: p } = await supabase.from("properties").select("address, postal_code, city, district, condition, energy_rating, floor, building_type").eq("id", id).maybeSingle();
  const { subject: s, check: c, comparables } = study;
  const place = [p?.address, [p?.postal_code, p?.city].filter(Boolean).join(" "), p?.district].filter(Boolean).join(", ");
  const per = (n: number | null) => (n == null ? "—" : `${formatPrice(n, s.currency)}/m²`);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 text-[14px] print:max-w-none print:px-0 print:py-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/properties/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Vissza az ingatlanhoz
        </Link>
        <PrintButton />
      </div>

      <header className="flex flex-col gap-1 border-b border-border pb-5">
        <p className="text-xs tracking-wide text-muted uppercase">Értékbecslő lap · {user.organization.name}</p>
        <h1 className="text-[26px] leading-tight">{s.title}</h1>
        {place && <p className="text-muted">{place}</p>}
        <p className="text-xs text-subtle">
          Készült: {formatDate(new Date())} · {user.fullName ?? user.email}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
        {[
          ["Típus", propertyTypeLabels[s.propertyType as keyof typeof propertyTypeLabels] ?? s.propertyType],
          ["Alapterület", formatArea(s.areaSqm)],
          ["Szobák", s.rooms != null ? formatNumber(s.rooms) : "—"],
          ["Állapot", p?.condition || "—"],
          ["Emelet", p?.floor || "—"],
          ["Energetika", p?.energy_rating || "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className="font-medium text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 print:border print:border-border print:bg-transparent">
        <h2 className="text-lg">Ár a piacon</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Irányár</p>
            <p className="text-lg font-medium text-ink tabular-nums">{formatPrice(s.price, s.currency)}</p>
            <p className="text-xs text-muted tabular-nums">{per(c.subjectPerSqm)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Hasonlók mediánja</p>
            <p className="text-lg font-medium text-ink tabular-nums">{per(c.median)}</p>
            <p className="text-xs text-muted tabular-nums">
              középső fél: {per(c.low)} – {per(c.high)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Reális sáv erre az alapterületre</p>
            <p className="text-lg font-medium text-ink tabular-nums">{c.range ? `${formatPrice(c.range.from, s.currency)} – ${formatPrice(c.range.to, s.currency)}` : "—"}</p>
            {c.difference != null && (
              <p className="text-xs text-muted">
                Az irányár {Math.abs(c.difference)}%-kal {c.difference >= 0 ? "a medián felett" : "a medián alatt"}
              </p>
            )}
          </div>
        </div>
        {c.thin && <p className="text-xs text-muted">Kevés összehasonlító adat ({c.count}): tájékoztató jellegű.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Összehasonlító ingatlanok</h2>
        {comparables.length ? (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Ingatlan</th>
                <th className="py-2 pr-3 font-medium">Alapterület</th>
                <th className="py-2 pr-3 font-medium">Szoba</th>
                <th className="py-2 pr-3 text-right font-medium">Ár</th>
                <th className="py-2 text-right font-medium">Ft/m²</th>
              </tr>
            </thead>
            <tbody>
              {comparables.slice(0, 15).map((x) => (
                <tr key={x.id} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3">
                    <p className="text-ink">{x.title}</p>
                    <p className="text-xs text-muted">
                      {x.place} · {x.basis === "agreed" ? `eladva (megállapodott ár), ${formatDate(x.date)}` : "irányár"}
                    </p>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{formatArea(x.areaSqm)}</td>
                  <td className="py-2 pr-3 tabular-nums">{x.rooms != null ? formatNumber(x.rooms) : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatPrice(x.price, s.currency)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPrice(Math.round(x.price / x.areaSqm), s.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">Még nincs hasonló ingatlan az iroda adatai között.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Megjegyzés</h2>
        {/* Typed here before printing; not saved. */}
        <div
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Kattints ide, és írd be a javaslatodat a tulajdonosnak (nyomtatás előtt)."
          className="min-h-24 rounded-xl border border-dashed border-border-strong p-3 whitespace-pre-wrap text-text empty:before:text-subtle empty:before:content-[attr(data-placeholder)] focus:outline-none print:border-none print:p-0 print:empty:hidden"
          aria-label="Megjegyzés a tulajdonosnak"
        />
      </section>

      <footer className="border-t border-border pt-4 text-xs text-muted">
        Az összehasonlítás az iroda saját nyilvántartásán alapul (hirdetési és, ahol van, megállapodott árak), tájékoztató jellegű, nem hivatalos értékbecslés.
      </footer>
    </article>
  );
}

export default function ValuationSheetPage({ params }: PageProps<"/properties/[id]/ertekeles">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-3xl shimmer rounded-2xl bg-surface" />}>
      <Sheet params={params} />
    </Suspense>
  );
}
