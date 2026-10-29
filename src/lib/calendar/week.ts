// The Flavio calendar's week: which days it shows, and which events fall on
// which day, in Budapest time. Pure functions, no I/O.

import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";

export type CalendarSource = "viewing" | "task" | "external";

export type CalendarEvent = {
  id: string;
  title: string;
  /** UTC ISO instants. All-day events span whole local days (end exclusive). */
  start: string;
  end: string;
  allDay: boolean;
  source: CalendarSource;
  /** Where it comes from, e.g. "Google Naptár · agent@iroda.hu" or a subscription's name. */
  calendar: string;
  color: string;
  location: string | null;
  /** In-app link (client, task) or the event in its own calendar. */
  href: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Monday of the week that contains `date` ("2026-10-29" → "2026-10-26"); today's week for a missing or malformed date. */
export function weekStart(date: string | null | undefined, now: Date, timeZone = DEFAULT_TIMEZONE) {
  const day = date && DATE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : utcToZonedLocal(now.toISOString(), timeZone).slice(0, 10);
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

/** The seven local dates from Monday, and the week's bounds as UTC instants. */
export function weekDays(monday: string, timeZone = DEFAULT_TIMEZONE) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return {
    days,
    from: new Date(zonedLocalToUtc(`${monday}T00:00`, timeZone)!),
    to: new Date(zonedLocalToUtc(`${addDays(monday, 7)}T00:00`, timeZone)!),
    previous: addDays(monday, -7),
    next: addDays(monday, 7),
  };
}

/** The local date an instant falls on. */
export const localDate = (iso: string, timeZone = DEFAULT_TIMEZONE) => utcToZonedLocal(iso, timeZone).slice(0, 10);

/**
 * Events per local day: all-day ones first, then by start time. An event that
 * runs over several days appears on each of them.
 */
export function eventsByDay(events: CalendarEvent[], days: string[], timeZone = DEFAULT_TIMEZONE): Map<string, CalendarEvent[]> {
  const byDay = new Map(days.map((d) => [d, [] as CalendarEvent[]]));
  for (const e of events) {
    const first = localDate(e.start, timeZone);
    // The end is exclusive: an event ending at midnight doesn't show on the next day.
    const last = localDate(new Date(Math.max(Date.parse(e.start), Date.parse(e.end) - 1)).toISOString(), timeZone);
    for (const d of days) if (d >= first && d <= last) byDay.get(d)!.push(e);
  }
  for (const list of byDay.values()) list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "hu"));
  return byDay;
}

/** "10:00–11:00", or "egész nap" for all-day events; times shown on the given day only. */
export function timeLabel(e: CalendarEvent, day: string, timeZone = DEFAULT_TIMEZONE) {
  if (e.allDay) return "egész nap";
  const start = utcToZonedLocal(e.start, timeZone);
  const end = utcToZonedLocal(e.end, timeZone);
  const from = start.slice(0, 10) === day ? start.slice(11, 16) : "00:00";
  const until = end.slice(0, 10) === day ? end.slice(11, 16) : "24:00";
  return from === until ? from : `${from}–${until}`;
}
