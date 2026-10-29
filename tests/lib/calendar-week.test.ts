import { describe, expect, it } from "vitest";
import { eventsInRange } from "@/lib/calendar/ics-import";
import { eventsByDay, timeLabel, weekDays, weekStart, type CalendarEvent } from "@/lib/calendar/week";

const now = new Date("2026-10-29T10:00:00Z"); // a Thursday

const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: "x",
  title: "Esemény",
  start: "2026-10-29T08:00:00.000Z",
  end: "2026-10-29T09:00:00.000Z",
  allDay: false,
  source: "external",
  calendar: "Teszt",
  color: "sky",
  location: null,
  href: null,
  ...p,
});

describe("the calendar week", () => {
  it("starts on Monday, also for a given date and around the clock change", () => {
    expect(weekStart(null, now)).toBe("2026-10-26");
    expect(weekStart("2026-11-01", now)).toBe("2026-10-26");
    expect(weekStart("nonsense", now)).toBe("2026-10-26");
    const w = weekDays("2026-10-19");
    expect(w.days).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    // Summer time ends on 25 October: the week starts at UTC+2 and ends at UTC+1.
    expect(w.from.toISOString()).toBe("2026-10-18T22:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(w.next).toBe("2026-10-26");
  });

  it("puts events on their Budapest day, all-day ones first, multi-day ones on each day", () => {
    const days = weekDays("2026-10-26").days;
    const late = ev({ id: "late", start: "2026-10-29T21:30:00.000Z", end: "2026-10-29T22:30:00.000Z" }); // 22:30 on the 29th
    const allDay = ev({ id: "allday", allDay: true, start: "2026-10-28T23:00:00.000Z", end: "2026-10-30T23:00:00.000Z" }); // 29th–30th
    const morning = ev({ id: "morning" });
    const by = eventsByDay([late, morning, allDay], days);
    expect(by.get("2026-10-29")!.map((e) => e.id)).toEqual(["allday", "morning", "late"]);
    expect(by.get("2026-10-30")!.map((e) => e.id)).toEqual(["allday"]);
    expect(by.get("2026-10-31")).toEqual([]);
    // Past midnight local time: on both days.
    const overnight = ev({ id: "overnight", start: "2026-10-29T22:30:00.000Z", end: "2026-10-29T23:30:00.000Z" });
    expect(eventsByDay([overnight], days).get("2026-10-30")!.map((e) => e.id)).toEqual(["overnight"]);
    expect(timeLabel(overnight, "2026-10-30")).toBe("00:00–00:30");
    expect(timeLabel(morning, "2026-10-29")).toBe("09:00–10:00");
    expect(timeLabel(allDay, "2026-10-30")).toBe("egész nap");
  });
});

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Teszt//HU",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Budapest",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  // Every Monday at 9:00, since September; the 2 November one moved to 11:00.
  "BEGIN:VEVENT",
  "UID:weekly@teszt",
  "DTSTART;TZID=Europe/Budapest:20260907T090000",
  "DTEND;TZID=Europe/Budapest:20260907T093000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO",
  "SUMMARY:Irodai megbeszélés",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:weekly@teszt",
  "RECURRENCE-ID;TZID=Europe/Budapest:20261102T090000",
  "DTSTART;TZID=Europe/Budapest:20261102T110000",
  "DTEND;TZID=Europe/Budapest:20261102T113000",
  "SUMMARY:Irodai megbeszélés (áttéve)",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:holiday@teszt",
  "DTSTART;VALUE=DATE:20261101",
  "DTEND;VALUE=DATE:20261102",
  "SUMMARY:Mindenszentek",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:utc@teszt",
  "DTSTART:20261030T120000Z",
  "DTEND:20261030T130000Z",
  "SUMMARY:Ebéd",
  "LOCATION:Bistro",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:gone@teszt",
  "DTSTART:20261030T150000Z",
  "DTEND:20261030T160000Z",
  "STATUS:CANCELLED",
  "SUMMARY:Elmarad",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("outside calendars by iCal link", () => {
  it("expands repeats, applies moved occurrences, keeps all-day dates and drops cancelled events", () => {
    const week = weekDays("2026-10-26");
    const events = eventsInRange(ICS, week.from, weekDays("2026-11-02").to);
    const titles = events.map((e) => `${e.title}|${e.start}`).sort();
    expect(titles).toEqual([
      "Ebéd|2026-10-30T12:00:00.000Z",
      "Irodai megbeszélés (áttéve)|2026-11-02T10:00:00.000Z",
      "Irodai megbeszélés|2026-10-26T08:00:00.000Z", // 9:00 in winter time
      "Mindenszentek|2026-10-31T23:00:00.000Z",
    ]);
    expect(events.find((e) => e.title === "Mindenszentek")).toMatchObject({ allDay: true, end: "2026-11-01T23:00:00.000Z" });
    expect(events.find((e) => e.title === "Ebéd")?.location).toBe("Bistro");
  });

  it("reads zones the file names without defining them, and floating times, as wall clock", () => {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:a", "DTSTART;TZID=Europe/London:20261030T090000", "DTEND;TZID=Europe/London:20261030T100000", "SUMMARY:London", "END:VEVENT", "BEGIN:VEVENT", "UID:b", "DTSTART:20261030T090000", "SUMMARY:Lebegő", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const events = eventsInRange(ics, new Date("2026-10-29T00:00:00Z"), new Date("2026-11-01T00:00:00Z"));
    // London is on GMT again by 30 October.
    expect(events.find((e) => e.title === "London")?.start).toBe("2026-10-30T09:00:00.000Z");
    expect(events.find((e) => e.title === "Lebegő")).toMatchObject({ start: "2026-10-30T08:00:00.000Z", end: "2026-10-30T08:00:00.000Z" });
  });

  it("rejects what isn't a calendar", () => {
    expect(() => eventsInRange("<html>nope</html>", new Date(), new Date())).toThrow();
  });
});
