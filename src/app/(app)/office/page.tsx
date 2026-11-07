import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AgentCard, OfficeGoals, OfficeHero, type MonthProgress } from "@/components/team/office-view";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { officeStats } from "@/lib/team/office-data";
import { monthBounds } from "@/lib/team/stats";

export const metadata: Metadata = { title: "Iroda" };

const monthTitle = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "UTC" });

/** How far through `month` today is (Budapest time). */
function monthProgress(month: string, today: string): MonthProgress {
  const b = monthBounds(month);
  const days = (Date.parse(`${b.end}T00:00:00Z`) - Date.parse(`${b.start}T00:00:00Z`)) / 86_400_000;
  if (today < b.start) return { elapsed: null, daysLeft: days };
  if (today >= b.end) return { elapsed: 1, daysLeft: 0 };
  const day = Number(today.slice(8, 10));
  return { elapsed: day / days, daysLeft: days - day };
}

async function Office({ searchParams }: Pick<PageProps<"/office">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const user = await getCurrentUser();
  const today = utcToZonedLocal(new Date().toISOString()).slice(0, 10);
  const current = today.slice(0, 7);
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : current;
  const b = monthBounds(month);
  const { agents, total } = await officeStats(user, month);
  const manager = user.organization.role !== "member";
  // Agents see the office's totals and their own card; owners and admins see everyone.
  const shown = manager ? agents : agents.filter((a) => a.userId === user.id);
  // The leader: most commission, then most deals (agents arrive sorted that way), once someone has scored.
  const leader = agents.length > 1 && (agents[0].commission > 0 || agents[0].dealsWon > 0) ? agents[0].userId : null;

  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader
        title="Iroda"
        description={manager ? "Hogy áll a hónap: az iroda és minden munkatárs, a havi célokkal." : "Hogy áll a hónap: az iroda és a te számaid, a célokkal."}
        actions={
          <nav aria-label="Hónap" className="flex items-center gap-1 rounded-full border border-border p-1">
            <Link href={`/office?month=${b.previous}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Előző hónap">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-36 text-center text-sm font-medium text-ink capitalize">{monthTitle.format(new Date(`${b.start}T00:00:00Z`))}</span>
            <Link href={`/office?month=${b.next}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Következő hónap">
              <ChevronRight className="size-4" />
            </Link>
          </nav>
        }
      />

      <OfficeHero total={total} progress={monthProgress(month, today)} manager={manager} />
      <OfficeGoals total={total} />

      <section className="flex flex-col gap-3">
        <h2 className="text-base tracking-tight">{manager ? "Munkatársak" : "A hónapod"}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => (
            <AgentCard
              key={a.userId}
              agent={a}
              rank={agents.length > 1 ? agents.indexOf(a) + 1 : null}
              leader={a.userId === leader}
              month={month}
              editable={manager}
              me={a.userId === user.id}
            />
          ))}
        </div>
      </section>

      <details className="text-xs text-muted">
        <summary className="w-fit cursor-pointer rounded-full px-2 py-1 hover:text-ink">Hogyan számolunk?</summary>
        <p className="reveal mt-2 max-w-3xl px-2">
          Jutalék: a hónapban sikeresen lezárt ügyletek jutaléka. Folyamatban: a még nyitott ügyletek várható jutaléka. Új megbízás: a hónapban felvett ingatlanok.
          Megtekintés: a megtartott megtekintések. Új ügyfél: a hónapban kiosztott új ügyfelek. A tempó-becslés a hónap eddigi napjaiból számol.
        </p>
      </details>
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
