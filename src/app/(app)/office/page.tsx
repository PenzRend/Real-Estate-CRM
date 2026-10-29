import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { TargetField } from "@/components/team/target-field";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/i18n/format";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { officeStats } from "@/lib/team/office-data";
import { monthBounds, progressPercent, type AgentMonth } from "@/lib/team/stats";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Iroda" };

const monthTitle = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "UTC" });

function Bar({ value, target }: { value: number; target: number | null }) {
  const p = progressPercent(value, target);
  if (p == null) return null;
  return (
    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
      <span className={cn("block h-full rounded-full", p >= 100 ? "bg-success" : p >= 60 ? "bg-accent" : "bg-warning")} style={{ width: `${Math.min(100, p)}%` }} />
    </span>
  );
}

type Metric = { key: "commission" | "deals" | "listings" | "viewings" | "leads" | "pipeline"; label: string; value: (a: Omit<AgentMonth, "userId" | "name" | "target">) => number; money?: boolean; target?: "commission" | "deals" | "listings" | "viewings" };
const metrics: Metric[] = [
  { key: "commission", label: "Jutalék", value: (a) => a.commission, money: true, target: "commission" },
  { key: "deals", label: "Lezárt ügylet", value: (a) => a.dealsWon, target: "deals" },
  { key: "listings", label: "Új megbízás", value: (a) => a.listings, target: "listings" },
  { key: "viewings", label: "Megtekintés", value: (a) => a.viewings, target: "viewings" },
  { key: "leads", label: "Új ügyfél", value: (a) => a.leads },
  { key: "pipeline", label: "Folyamatban", value: (a) => a.pipeline, money: true },
];

async function Office({ searchParams }: Pick<PageProps<"/office">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const user = await getCurrentUser();
  const current = utcToZonedLocal(new Date().toISOString()).slice(0, 7);
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : current;
  const b = monthBounds(month);
  const { agents, total } = await officeStats(user, month);
  const manager = user.organization.role !== "member";
  // Agents see the office's totals and their own row; owners and admins see everyone.
  const rows = manager ? agents : agents.filter((a) => a.userId === user.id);
  const fmt = (m: Metric, v: number) => (m.money ? formatPrice(v) : String(v));

  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader
        title="Iroda"
        description={manager ? "A hónap számai munkatársanként, a havi célokkal. A célokat a táblázatban írhatod be." : "Az iroda és a te havi számaid, a célokkal."}
        actions={
          <nav aria-label="Hónap" className="flex items-center gap-1">
            <Link href={`/office?month=${b.previous}`} className={buttonClasses("secondary", "sm")} aria-label="Előző hónap">
              <ChevronLeft />
            </Link>
            <span className="min-w-36 text-center text-sm font-medium text-ink">{monthTitle.format(new Date(`${b.start}T00:00:00Z`))}</span>
            <Link href={`/office?month=${b.next}`} className={buttonClasses("secondary", "sm")} aria-label="Következő hónap">
              <ChevronRight />
            </Link>
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {metrics.map((m) => {
          const target = m.target ? total.target[m.target] : null;
          return (
            <div key={m.key} className="rounded-2xl bg-surface p-4">
              <p className="text-[20px] font-medium tracking-[-0.02em] text-ink tabular-nums">{fmt(m, m.value(total))}</p>
              <p className="text-xs text-muted">
                {m.label}
                {target != null && ` · cél: ${fmt(m, target)}`}
              </p>
              <Bar value={m.value(total)} target={target} />
            </div>
          );
        })}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-5 py-3 font-medium">Munkatárs</th>
              {metrics.map((m) => (
                <th key={m.key} className="px-3 py-3 text-right font-medium">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.userId} className="border-b border-border/70 align-top last:border-b-0">
                <td className="px-5 py-3 font-medium text-ink">{a.name}</td>
                {metrics.map((m) => {
                  const target = m.target ? (a.target?.[m.target] ?? null) : null;
                  return (
                    <td key={m.key} className="px-3 py-3 text-right tabular-nums">
                      <span className="text-ink">{fmt(m, m.value(a))}</span>
                      {m.target && manager ? (
                        <span className="mt-1 flex justify-end pr-4">
                          <TargetField userId={a.userId} month={month} field={m.target} value={target} label={`${a.name} – ${m.label} cél`} />
                        </span>
                      ) : (
                        target != null && <span className="block text-xs text-muted">cél: {fmt(m, target)}</span>
                      )}
                      {m.target && <Bar value={m.value(a)} target={target} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted">
        Jutalék: a hónapban sikeresen lezárt ügyletek jutaléka. Új megbízás: a hónapban felvett ingatlanok. Megtekintés: a megtartott megtekintések. Új ügyfél: a hónapban
        kiosztott új ügyfelek.
      </p>
    </div>
  );
}

export default function OfficePage({ searchParams }: PageProps<"/office">) {
  return (
    <PageSuspense>
      <Office searchParams={searchParams} />
    </PageSuspense>
  );
}
