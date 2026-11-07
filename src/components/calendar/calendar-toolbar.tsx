"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ViewTabs } from "@/components/ui/view-tabs";
import { monthGrid, weekDays, weekStart } from "@/lib/calendar/week";

const dayMonth = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const monthTitle = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "UTC" });
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

/**
 * The calendar's title, Hónap / Hét switch and paging. It works out the month
 * or week from the URL itself, so it changes the moment an arrow is clicked
 * while only the grid below loads. `connections` is the "Naptárak" button.
 */
export function CalendarToolbar({ connections }: { connections: ReactNode }) {
  const params = useSearchParams();
  const now = new Date();
  const view = params.get("view") === "week" ? "week" : "month";
  const month = monthGrid(params.get("month"), now);
  const week = weekDays(weekStart(params.get("week"), now));
  const title = view === "month" ? monthTitle.format(asDate(month.first)) : `${fullDate.format(asDate(week.days[0]))} – ${dayMonth.format(asDate(week.days[6]))}`;
  // "Csak az enyéim" stays on while paging.
  const who = params.get("who") === "mine" ? "who=mine" : "";
  const withWho = (href: string) => (who ? `${href}${href.includes("?") ? "&" : "?"}${who}` : href);
  const nav =
    view === "month"
      ? { previous: withWho(`/calendar?month=${month.previous}`), next: withWho(`/calendar?month=${month.next}`), today: withWho("/calendar") }
      : { previous: withWho(`/calendar?view=week&week=${week.previous}`), next: withWho(`/calendar?view=week&week=${week.next}`), today: withWho("/calendar?view=week") };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <ViewTabs
          label="Nézet"
          keep={["who"]}
          items={[
            { value: "month", label: "Hónap" },
            { value: "week", label: "Hét" },
          ]}
        />
        <ViewTabs
          param="who"
          label="Kié"
          keep={["view", "month", "week"]}
          items={[
            { value: "office", label: "Iroda" },
            { value: "mine", label: "Csak az enyéim" },
          ]}
        />
        {connections}
        <nav aria-label="Lapozás" className="flex items-center gap-1">
          <Link href={nav.previous} scroll={false} className={buttonClasses("secondary", "sm")} aria-label={view === "month" ? "Előző hónap" : "Előző hét"}>
            <ChevronLeft />
          </Link>
          <Link href={nav.today} scroll={false} className={buttonClasses("secondary", "sm")}>
            Ma
          </Link>
          <Link href={nav.next} scroll={false} className={buttonClasses("secondary", "sm")} aria-label={view === "month" ? "Következő hónap" : "Következő hét"}>
            <ChevronRight />
          </Link>
        </nav>
      </div>
    </div>
  );
}
