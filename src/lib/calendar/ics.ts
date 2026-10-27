// iCalendar (RFC 5545) output for the calendar subscription link: what
// iPhone/Mac Calendar, Outlook and Google Calendar read from an .ics URL.

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  cancelled?: boolean;
  updated: Date;
};

/** Text values: backslash, semicolon, comma and line breaks are escaped. */
export function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 20261103T160000Z */
export function icsTime(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lines longer than 75 bytes continue on the next line after a space, never splitting a character. */
export function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The first line holds 75 bytes; continuation lines lose one to the leading space.
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs({ name, events, now = new Date() }: { name: string; events: IcsEvent[]; now?: Date }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flavio//Megtekintesek//HU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Europe/Budapest",
    // Ask subscribing apps to check back every 30 minutes.
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${icsTime(now)}`,
      `LAST-MODIFIED:${icsTime(e.updated)}`,
      `DTSTART:${icsTime(e.start)}`,
      `DTEND:${icsTime(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
