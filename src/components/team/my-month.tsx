import { ArrowLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatPrice } from "@/lib/i18n/format";
import { progressPercent, type AgentMonth } from "@/lib/team/stats";
import { cn } from "@/lib/cn";

/** The agent's own month on the dashboard: commission, deals, listings, viewings, against the targets. */
export function MyMonth({ me }: { me: AgentMonth }) {
  const rows = [
    { label: "Jutalék", value: me.commission, target: me.target?.commission ?? null, money: true },
    { label: "Lezárt ügylet", value: me.dealsWon, target: me.target?.deals ?? null },
    { label: "Új megbízás", value: me.listings, target: me.target?.listings ?? null },
    { label: "Megtekintés", value: me.viewings, target: me.target?.viewings ?? null },
  ];
  return (
    <Card>
      <CardHeader title="A hónapom" action={<ArrowLink href="/office">Iroda</ArrowLink>} />
      <ul className="flex flex-col gap-3 p-5">
        {rows.map((r) => {
          const p = progressPercent(r.value, r.target);
          return (
            <li key={r.label} className="text-sm">
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-muted">{r.label}</span>
                <span className="font-medium text-ink tabular-nums">
                  {r.money ? formatPrice(r.value) : r.value}
                  {r.target != null && <span className="font-normal text-muted"> / {r.money ? formatPrice(r.target) : r.target}</span>}
                </span>
              </p>
              {p != null && (
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-strong">
                  <span className={cn("block h-full rounded-full", p >= 100 ? "bg-success" : p >= 60 ? "bg-accent" : "bg-warning")} style={{ width: `${Math.min(100, p)}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!me.target && <p className="border-t border-border px-5 py-3 text-xs text-muted">Havi célt a tulajdonos vagy egy admin állíthat be az Iroda oldalon.</p>}
    </Card>
  );
}
