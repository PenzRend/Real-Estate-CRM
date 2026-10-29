import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { eventColors } from "@/components/calendar/colors";
import { Subscriptions } from "@/components/calendar/subscriptions";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { calendarEvents, listSubscriptions } from "@/lib/calendar/data";
import { hasCalendarFeed } from "@/lib/calendar/feed";
import { eventsByDay, localDate, timeLabel, weekDays, weekStart, type CalendarEvent } from "@/lib/calendar/week";
import { cn } from "@/lib/cn";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { permissionHref } from "@/lib/mail/provider";
import { listMailboxes } from "@/lib/mail/sync";

export const metadata: Metadata = { title: "Naptár" };

const weekday = new Intl.DateTimeFormat("hu-HU", { weekday: "long", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

function EventItem({ e, day }: { e: CalendarEvent; day: string }) {
  const body = (
    <>
      <p className="text-[11px] font-medium text-muted tabular-nums">{timeLabel(e, day)}</p>
      <p className="line-clamp-3 text-[13px] leading-snug font-medium text-ink">{e.title}</p>
      {e.location && <p className="truncate text-[11px] text-muted">{e.location}</p>}
      <p className="truncate text-[11px] text-subtle">{e.calendar}</p>
    </>
  );
  const className = cn("block rounded-lg border-l-4 px-2.5 py-1.5", eventColors[e.color]?.bar ?? eventColors.slate.bar);
  if (!e.href) return <div className={className}>{body}</div>;
  const external = e.href.startsWith("http");
  return external ? (
    <a href={e.href} target="_blank" rel="noopener noreferrer" className={cn(className, "hover:brightness-95")}>
      {body}
    </a>
  ) : (
    <Link href={e.href} className={cn(className, "hover:brightness-95")}>
      {body}
    </Link>
  );
}

async function CalendarContent({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const user = await getCurrentUser();
  const monday = weekStart(typeof params.week === "string" ? params.week : null, now);
  const week = weekDays(monday);
  const today = localDate(now.toISOString(), DEFAULT_TIMEZONE);

  const [data, subscriptions, mailboxes, feedActive] = await Promise.all([
    calendarEvents(user, week.from, week.to),
    listSubscriptions(user),
    listMailboxes(user).catch(() => []),
    hasCalendarFeed(user),
  ]);
  const byDay = eventsByDay(data.events, week.days);
  const canAskCalendar = mailboxes.some((m) => m.provider !== "imap" && m.status !== "revoked" && !m.can_calendar);
  const hasOAuth = mailboxes.some((m) => m.provider !== "imap");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Naptár" description="Megtekintések, feladatok és a saját naptáraid egy helyen – és a Flavio a többi naptáradban is." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">
          {fullDate.format(asDate(week.days[0]))} – {dayMonth.format(asDate(week.days[6]))}
        </h2>
        <nav aria-label="Hetek" className="flex items-center gap-1">
          <Link href={`/calendar?week=${week.previous}`} className={buttonClasses("secondary", "sm")} aria-label="Előző hét">
            <ChevronLeft />
          </Link>
          <Link href="/calendar" className={buttonClasses("secondary", "sm")}>
            Ma
          </Link>
          <Link href={`/calendar?week=${week.next}`} className={buttonClasses("secondary", "sm")} aria-label="Következő hét">
            <ChevronRight />
          </Link>
        </nav>
      </div>

      {data.problems.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            {data.problems.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <ol className="grid grid-cols-1 divide-y divide-border lg:grid-cols-7 lg:divide-x lg:divide-y-0">
          {week.days.map((day) => {
            const events = byDay.get(day) ?? [];
            const isToday = day === today;
            return (
              <li key={day} className={cn("flex min-w-0 flex-col gap-2 p-3 lg:min-h-64", isToday && "bg-accent-soft/40")}>
                <p className="flex items-baseline gap-2 lg:flex-col lg:gap-0">
                  <span className={cn("text-xs font-medium capitalize", isToday ? "text-accent" : "text-muted")}>{weekday.format(asDate(day))}</span>
                  <span className={cn("text-sm", isToday ? "font-semibold text-accent" : "text-ink")}>{dayMonth.format(asDate(day))}</span>
                </p>
                {events.length ? (
                  <div className="flex flex-col gap-1.5">
                    {events.map((e) => (
                      <EventItem key={`${e.id}|${day}`} e={e} day={day} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-subtle">Szabad</p>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent" /> Megtekintés (az egész irodáé)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" /> Feladat
        </span>
        {data.connected.map((c) => (
          <span key={c.email} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", c.label.startsWith("Google") ? "bg-sky-500" : "bg-violet-500")} /> {c.label} · {c.email}
          </span>
        ))}
        {subscriptions.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", eventColors[s.color]?.dot)} /> {s.name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Naptáraid a Flavióban</h2>
          <p className="text-sm text-muted">
            A Google- és Outlook-naptárad eseményei a postafiók-kapcsolaton keresztül jelennek meg; minden más naptárat (iCloud, céges, családi…) a linkjével
            adhatsz hozzá.
          </p>
          {canAskCalendar ? (
            <a href={permissionHref("calendar", "/calendar")} className={buttonClasses("secondary", "sm", "w-fit")}>
              <ShieldCheck /> Google- vagy Outlook-naptár engedélyezése
            </a>
          ) : (
            !hasOAuth && (
              <Link href="/inbox" className={buttonClasses("secondary", "sm", "w-fit")}>
                <CalendarDays /> Google- vagy Outlook-fiók összekapcsolása
              </Link>
            )
          )}
          <Subscriptions subscriptions={subscriptions} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">A Flavio a többi naptáradban</h2>
          <p className="text-sm text-muted">
            A foglalt megtekintések maguktól bekerülnek a Google- vagy Outlook-naptáradba (ha engedélyezted), feliratkozással pedig bármelyik naptárba: iPhone,
            Mac, Android, Outlook, Thunderbird…
          </p>
          <div className="grid grid-cols-1">
            <CalendarFeed active={feedActive} />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CalendarContent searchParams={searchParams} />
    </Suspense>
  );
}
