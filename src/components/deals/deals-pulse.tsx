import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { ArrowLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { DealSummary } from "@/lib/deals/data";
import { formatDate, formatPrice } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";

/** The dashboard's deals card: this month's commission and the deal dates coming up. */
export function DealsPulse({ summary: s, today }: { summary: DealSummary; today: string }) {
  return (
    <Card>
      <CardHeader title="Ügyletek" count={s.openCount} action={<ArrowLink href="/deals">Összes</ArrowLink>} />
      <div className="grid grid-cols-2 border-b border-border">
        <div className="px-5 py-3">
          <p className="text-lg font-medium text-ink tabular-nums">{formatPrice(s.thisMonthCommission)}</p>
          <p className="text-xs text-muted">várható jutalék e hónapban</p>
        </div>
        <div className="border-l border-border px-5 py-3">
          <p className="text-lg font-medium text-ink tabular-nums">{formatPrice(s.pipelineCommission)}</p>
          <p className="text-xs text-muted">a folyamatban lévőkben</p>
        </div>
      </div>
      {s.upcoming.length ? (
        <ul className="divide-y divide-border">
          {s.upcoming.map((u) => (
            <li key={`${u.dealId}-${u.label}`}>
              <Link href={`/deals/${u.dealId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
                <CalendarClock className={cn("size-4 shrink-0", u.date === today ? "text-accent" : "text-muted")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{u.property}</span>
                  <span className="text-xs text-muted">
                    {u.label}: {u.date === today ? "ma" : formatDate(u.date)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">{s.openCount ? "A következő két hétben nincs ügylet-határidő." : "Ha egy vevő ajánlatot tesz, az ingatlan oldalán indíts ügyletet."}</p>
      )}
    </Card>
  );
}
