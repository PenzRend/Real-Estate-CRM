import { FileBarChart, Scale } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { PriceStudy } from "@/lib/listings/comparables";
import { formatPrice } from "@/lib/i18n/format";

const verdicts = {
  low: { label: "Az átlag alatt", tone: "accent" as const },
  fair: { label: "Piaci szinten", tone: "success" as const },
  high: { label: "Az átlag felett", tone: "warning" as const },
  unknown: { label: "Nincs elég adat", tone: "neutral" as const },
};

/** Where the asking price per m² sits among comparable properties the office knows, and the valuation sheet. */
export function PriceCheckCard({ propertyId, study }: { propertyId: string; study: PriceStudy }) {
  const { check: c, subject: s } = study;
  const per = (n: number | null) => (n == null ? "—" : `${formatPrice(n, s.currency)}/m²`);
  return (
    <Card>
      <CardHeader title="Ár és piac" action={<Badge tone={verdicts[c.verdict].tone}>{verdicts[c.verdict].label}</Badge>} />
      <div className="flex flex-col gap-3 p-5 text-sm">
        {c.count ? (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted">Ez az ingatlan</dt>
                <dd className="font-medium text-ink tabular-nums">{per(c.subjectPerSqm)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Hasonlók mediánja ({c.count})</dt>
                <dd className="font-medium text-ink tabular-nums">{per(c.median)}</dd>
              </div>
            </dl>
            {c.difference != null && (
              <p className="text-text">
                Az irányár {Math.abs(c.difference)}%-kal {c.difference >= 0 ? "a hasonlók mediánja felett" : "a hasonlók mediánja alatt"} van.
                {c.range && (
                  <>
                    {" "}
                    A középső fél alapján reális sáv: <span className="font-medium tabular-nums">{formatPrice(c.range.from, s.currency)} – {formatPrice(c.range.to, s.currency)}</span>.
                  </>
                )}
              </p>
            )}
            {c.thin && <p className="text-xs text-warning">Kevés összehasonlító adat – minél több ingatlan és lezárt ügylet van a Flavióban, annál pontosabb.</p>}
          </>
        ) : (
          <p className="flex gap-2 text-muted">
            <Scale className="mt-0.5 size-4 shrink-0" />
            Még nincs hasonló ingatlan a Flavióban (azonos típus, település, ±35% alapterület). Ahogy gyűlnek a hirdetések és a lezárt ügyletek, itt látod, hol áll az ár.
          </p>
        )}
        <Link href={`/properties/${propertyId}/ertekeles`} className={buttonClasses("secondary", "sm", "w-fit")}>
          <FileBarChart /> Értékbecslő lap a tulajdonosnak
        </Link>
      </div>
    </Card>
  );
}
