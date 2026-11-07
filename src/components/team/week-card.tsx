import { Star } from "lucide-react";
import { ArrowLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/i18n/format";
import type { WeekSummary } from "@/lib/team/week-summary";
import { trend } from "@/lib/team/week-text";

const day = new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Múlt hét az irodában": for owners and admins at the start of the week. */
export function WeekCard({ summary: s }: { summary: WeekSummary }) {
  const rows = [
    { label: "Új ügyfél", now: s.week.leads, before: s.before.leads },
    { label: "Megtekintés", now: s.week.viewings, before: s.before.viewings },
    { label: "Új megbízás", now: s.week.listings, before: s.before.listings },
    { label: "Lezárt ügylet", now: s.week.dealsWon, before: s.before.dealsWon },
  ];
  const lastDay = new Date(Date.parse(`${s.to}T00:00:00Z`) - 86_400_000);
  return (
    <Card>
      <CardHeader title="Múlt hét az irodában" action={<ArrowLink href="/office">Iroda</ArrowLink>} />
      <div className="flex flex-col gap-4 p-5">
        <p className="text-xs text-muted">
          {day.format(new Date(`${s.from}T00:00:00Z`))} – {day.format(lastDay)}, az előző héthez képest
        </p>
        <ul className="grid grid-cols-2 gap-3">
          {rows.map((r) => {
            const t = trend(r.now, r.before);
            return (
              <li key={r.label} className="rounded-2xl bg-surface p-3">
                <p className="flex items-baseline gap-2">
                  <span className="text-2xl font-medium tracking-tight text-ink tabular-nums">{r.now}</span>
                  {t && <span className={cn("text-xs font-medium", r.now > r.before ? "text-success" : "text-danger")}>{t}</span>}
                </p>
                <p className="text-xs text-muted">{r.label}</p>
              </li>
            );
          })}
        </ul>
        {s.week.commission > 0 && (
          <p className="text-sm text-muted">
            Jutalék: <span className="font-medium text-ink">{formatPrice(s.week.commission)}</span>
          </p>
        )}
        {s.star && (
          <p className="flex items-center gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-sm text-warning">
            <Star className="size-4 shrink-0" /> A hét csillaga: <span className="font-medium">{s.star.name}</span> ({s.star.deals} lezárás)
          </p>
        )}
      </div>
    </Card>
  );
}
