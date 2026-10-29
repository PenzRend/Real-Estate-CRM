// Reading an outside calendar's iCal file (iCloud, Google, Outlook or any
// other calendar's subscription link): its events in a time range, with
// repeating events expanded. No I/O.

import ICAL from "ical.js";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";

export type ImportedEvent = { uid: string; title: string; start: string; end: string; allDay: boolean; location: string | null };

type Time = InstanceType<typeof ICAL.Time>;

const MAX_OCCURRENCES = 1000; // per repeating event, while walking up to the range
const MAX_EVENTS = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

function isTimeZone(tzid: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzid });
    return true;
  } catch {
    return false;
  }
}

/**
 * An iCal time as a UTC instant. Dates are whole local days; times in a zone
 * the file defines (or UTC) convert directly; "floating" times, and zones the
 * file names but doesn't define, are read as wall clock there (Budapest when
 * the zone is unknown).
 */
function instant(t: Time): string {
  const local = `${t.year}-${pad(t.month)}-${pad(t.day)}T${t.isDate ? "00:00" : `${pad(t.hour)}:${pad(t.minute)}`}`;
  const tzid = (t as Time & { timezone?: string }).timezone;
  const zone = t.zone;
  if (!t.isDate && zone && zone !== ICAL.Timezone.localTimezone) return new Date(t.toUnixTime() * 1000).toISOString();
  return zonedLocalToUtc(local, !t.isDate && tzid && isTimeZone(tzid) ? tzid : DEFAULT_TIMEZONE) ?? new Date(t.toUnixTime() * 1000).toISOString();
}

function clean(text: unknown, max: number) {
  return typeof text === "string" && text.trim() ? text.replace(/\s+/g, " ").trim().slice(0, max) : null;
}

/** The events of an iCal document that overlap [from, to). Throws on a document that isn't iCal. */
export function eventsInRange(ics: string, from: Date, to: Date): ImportedEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      // A broken zone definition: its times fall back to wall clock below.
    }
  }

  const vevents = root.getAllSubcomponents("vevent");
  // Changed or moved single occurrences of a repeating event (RECURRENCE-ID).
  const exceptions = new Map<string, InstanceType<typeof ICAL.Component>[]>();
  for (const v of vevents) {
    if (!v.hasProperty("recurrence-id")) continue;
    const uid = String(v.getFirstPropertyValue("uid") ?? "");
    exceptions.set(uid, [...(exceptions.get(uid) ?? []), v]);
  }

  const out: ImportedEvent[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const push = (uid: string, title: unknown, location: unknown, start: Time, end: Time | null, status: unknown) => {
    if (String(status ?? "").toUpperCase() === "CANCELLED") return;
    const s = instant(start);
    let e = end ? instant(end) : null;
    // No end: a day for all-day events, otherwise a point in time.
    if (!e || Date.parse(e) <= Date.parse(s)) e = new Date(Date.parse(s) + (start.isDate ? 86_400_000 : 0)).toISOString();
    const sMs = Date.parse(s);
    const eMs = Date.parse(e);
    // Overlaps [from, to); a point-in-time event counts when it falls inside.
    if (sMs >= toMs || (eMs > sMs ? eMs <= fromMs : sMs < fromMs)) return;
    out.push({ uid, title: clean(title, 200) ?? "(nincs cím)", start: s, end: e, allDay: start.isDate, location: clean(location, 300) });
  };

  for (const v of vevents) {
    if (out.length >= MAX_EVENTS) break;
    if (v.hasProperty("recurrence-id")) continue; // handled with its series
    const event = new ICAL.Event(v);
    for (const x of exceptions.get(event.uid) ?? []) event.relateException(x);
    const status = v.getFirstPropertyValue("status");
    if (!event.startDate) continue;

    if (!event.isRecurring()) {
      push(event.uid, event.summary, event.location, event.startDate, event.endDate, status);
      continue;
    }
    const it = event.iterator();
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const next = it.next();
      if (!next) break;
      const occurrence = event.getOccurrenceDetails(next);
      if (Date.parse(instant(occurrence.startDate)) >= toMs) break;
      const item = occurrence.item;
      push(`${event.uid}/${instant(next)}`, item.summary, item.location, occurrence.startDate, occurrence.endDate, item.component.getFirstPropertyValue("status") ?? status);
    }
  }
  return out;
}
