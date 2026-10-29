import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { eventColors } from "@/components/calendar/colors";
import { CalendarSources, type CalendarAccount } from "@/components/calendar/sources";
import { Subscriptions } from "@/components/calendar/subscriptions";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { calendarEvents, isICloudAddress, listSubscriptions } from "@/lib/calendar/data";
import { hasCalendarFeed } from "@/lib/calendar/feed";
import { eventsByDay, localDate, monthGrid, timeLabel, weekDays, weekStart, type CalendarEvent } from "@/lib/calendar/week";
import { cn } from "@/lib/cn";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { configuredProviders } from "@/lib/mail/configured";
import { listMailboxes } from "@/lib/mail/sync";

export const metadata: Metadata = { title: "Naptár" };

const weekday = new Intl.DateTimeFormat("hu-HU", { weekday: "long", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("hu-HU", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const monthTitle = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "UTC" });

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const MONTH_CELL_EVENTS = 3;

function eventClass(e: CalendarEvent) {
  return cn("block rounded-lg border-l-4 px-2.5 py-1.5", eventColors[e.color]?.bar ?? eventColors.slate.bar);
}

/** The event as a link: an app page, the event in its own calendar, or nothing. */
function EventLink({ e, className, children }: { e: CalendarEvent; className: string; children: React.ReactNode }) {
  if (!e.href) return <div className={className}>{children}</div>;
  return e.href.startsWith("http") ? (
    <a href={e.href} target="_blank" rel="noopener noreferrer" className={cn(className, "hover:brightness-95")}>
      {children}
    </a>
  ) : (
    <Link href={e.href} className={cn(className, "hover:brightness-95")}>
      {children}
    </Link>
  );
}

function EventItem({ e, day }: { e: CalendarEvent; day: string }) {
  return (
    <EventLink e={e} className={eventClass(e)}>
      <p className="text-[11px] font-medium text-muted tabular-nums">{timeLabel(e, day)}</p>
      <p className="line-clamp-3 text-[13px] leading-snug font-medium text-ink">{e.title}</p>
      {e.location && <p className="truncate text-[11px] text-muted">{e.location}</p>}
      <p className="truncate text-[11px] text-subtle">{e.calendar}</p>
    </EventLink>
  );
}

/** One line in a month cell: all-day events as a coloured bar, timed ones as a dot with the start time. */
function MonthEvent({ e, day }: { e: CalendarEvent; day: string }) {
  const color = eventColors[e.color] ?? eventColors.slate;
  if (e.allDay) {
    return (
      <EventLink e={e} className={cn("block truncate rounded px-1.5 py-0.5 text-[12px] leading-tight font-medium text-ink", color.bar.replace(/border-l-\S+/, ""))}>
        {e.title}
      </EventLink>
    );
  }
  return (
    <EventLink e={e} className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[12px] leading-tight hover:bg-surface">
      <span className={cn("size-1.5 shrink-0 rounded-full", color.dot)} />
      <span className="shrink-0 text-muted tabular-nums">{timeLabel(e, day).slice(0, 5)}</span>
      <span className="truncate text-ink">{e.title}</span>
    </EventLink>
  );
}

const views = [
  { key: "month", label: "Hónap" },
  { key: "week", label: "Hét" },
] as const;

async function CalendarContent({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const user = await getCurrentUser();
  const view = params.view === "week" ? "week" : "month";
  const today = localDate(now.toISOString(), DEFAULT_TIMEZONE);

  const month = monthGrid(typeof params.month === "string" ? params.month : null, now);
  const week = weekDays(weekStart(typeof params.week === "string" ? params.week : null, now));
  const range = view === "month" ? month : week;

  const [data, subscriptions, mailboxes, feedActive] = await Promise.all([
    calendarEvents(user, range.from, range.to),
    listSubscriptions(user),
    listMailboxes(user).catch(() => []),
    hasCalendarFeed(user),
  ]);
  const byDay = eventsByDay(data.events, range.days);
  const accounts: CalendarAccount[] = mailboxes.flatMap((m) =>
    m.provider !== "imap" && m.status !== "revoked" ? [{ id: m.id, email: m.email_address, provider: m.provider, canCalendar: m.can_calendar }] : [],
  );
  const icloudMailboxes = mailboxes.filter((m) => m.provider === "imap" && m.status !== "revoked" && isICloudAddress(m.email_address)).map((m) => ({ id: m.id, email: m.email_address }));
  const configured = configuredProviders().filter((p): p is CalendarAccount["provider"] => p !== "imap");

  const title = view === "month" ? monthTitle.format(asDate(month.first)) : `${fullDate.format(asDate(week.days[0]))} – ${dayMonth.format(asDate(week.days[6]))}`;
  const nav =
    view === "month"
      ? { previous: `/calendar?month=${month.previous}`, next: `/calendar?month=${month.next}`, today: "/calendar" }
      : { previous: `/calendar?view=week&week=${week.previous}`, next: `/calendar?view=week&week=${week.next}`, today: "/calendar?view=week" };

  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader title="Naptár" description="Megtekintések, feladatok, a Google-, Apple- és Outlook-naptárad egy helyen – és a Flavio a többi naptáradban is." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Nézet" className="flex gap-1 rounded-full border border-border p-1">
            {views.map((v) => (
              <Link
                key={v.key}
                href={v.key === "month" ? "/calendar" : "/calendar?view=week"}
                aria-current={v.key === view ? "page" : undefined}
                className={cn("rounded-full px-4 py-1 text-sm transition-colors", v.key === view ? "bg-primary font-medium text-white" : "text-muted hover:text-ink")}
              >
                {v.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Lapozás" className="flex items-center gap-1">
            <Link href={nav.previous} className={buttonClasses("secondary", "sm")} aria-label={view === "month" ? "Előző hónap" : "Előző hét"}>
              <ChevronLeft />
            </Link>
            <Link href={nav.today} className={buttonClasses("secondary", "sm")}>
              Ma
            </Link>
            <Link href={nav.next} className={buttonClasses("secondary", "sm")} aria-label={view === "month" ? "Következő hónap" : "Következő hét"}>
              <ChevronRight />
            </Link>
          </nav>
        </div>
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

      {view === "month" ? (
        <>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-surface/60">
              {month.days.slice(0, 7).map((d) => (
                <p key={d} className="px-2 py-2 text-center text-xs font-medium text-muted capitalize sm:text-left">
                  <span className="sm:hidden">{weekdayShort.format(asDate(d)).replace(/\.$/, "")}</span>
                  <span className="hidden sm:inline">{weekday.format(asDate(d))}</span>
                </p>
              ))}
            </div>
            <ol className="grid grid-cols-7">
              {month.days.map((day, i) => {
                const events = byDay.get(day) ?? [];
                const isToday = day === today;
                const extra = events.length - MONTH_CELL_EVENTS;
                return (
                  <li
                    key={day}
                    className={cn(
                      "flex min-h-16 min-w-0 flex-col gap-1 border-border p-1 sm:min-h-32 sm:p-1.5 xl:min-h-36",
                      i % 7 !== 6 && "border-r",
                      i < month.days.length - 7 && "border-b",
                      !month.inMonth(day) && "bg-surface/50",
                    )}
                  >
                    <Link
                      href={`/calendar?view=week&week=${day}`}
                      title="Megnyitás heti nézetben"
                      className={cn(
                        "grid size-7 place-items-center self-center rounded-full text-sm sm:self-start",
                        isToday ? "bg-accent font-semibold text-white" : month.inMonth(day) ? "text-ink hover:bg-surface" : "text-subtle hover:bg-surface",
                      )}
                    >
                      {Number(day.slice(8))}
                    </Link>
                    {/* Phones: dots only; the list below has the details. */}
                    <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                      {events.slice(0, 4).map((e) => (
                        <span key={e.id} className={cn("size-1.5 rounded-full", (eventColors[e.color] ?? eventColors.slate).dot)} />
                      ))}
                    </div>
                    <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {events.slice(0, MONTH_CELL_EVENTS).map((e) => (
                        <MonthEvent key={e.id} e={e} day={day} />
                      ))}
                      {extra > 0 && (
                        <Link href={`/calendar?view=week&week=${day}`} className="px-1 text-[12px] font-medium text-muted hover:text-ink">
                          +{extra} további
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Phones: the month as a list of days that have something. */}
          <ol className="flex flex-col gap-4 sm:hidden">
            {month.days
              .filter((d) => month.inMonth(d) && d >= today && (byDay.get(d)?.length ?? 0) > 0)
              .map((d) => (
                <li key={d} className="flex flex-col gap-1.5">
                  <p className={cn("text-sm font-medium capitalize", d === today ? "text-accent" : "text-ink")}>
                    {weekday.format(asDate(d))}, {dayMonth.format(asDate(d))}
                  </p>
                  {byDay.get(d)!.map((e) => (
                    <EventItem key={e.id} e={e} day={d} />
                  ))}
                </li>
              ))}
          </ol>
        </>
      ) : (
        <Card className="overflow-hidden">
          <ol className="grid grid-cols-1 divide-y divide-border lg:grid-cols-7 lg:divide-x lg:divide-y-0">
            {week.days.map((day) => {
              const events = byDay.get(day) ?? [];
              const isToday = day === today;
              return (
                <li key={day} className={cn("flex min-w-0 flex-col gap-2 p-3 lg:min-h-96", isToday && "bg-accent-soft/40")}>
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
      )}

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
          <p className="text-sm text-muted">Csak te látod őket. Az iPhone-od naptára az iCloud-naptár: az Apple ID-ddal és egy alkalmazásjelszóval jelenik meg itt.</p>
          <CalendarSources accounts={accounts} configured={configured} calendars={subscriptions.filter((s) => s.kind === "caldav")} icloudMailboxes={icloudMailboxes} />
          <Subscriptions subscriptions={subscriptions.filter((s) => s.kind === "ics")} />
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
