// Reading CalDAV (WebDAV) replies: the few properties Flavio asks for, in
// whatever namespace prefixes the server uses. Pure functions, no I/O.

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

export function decodeXml(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()],
    );
}

const tagRe = (name: string) => new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>)`, "gi");

/** Inner XML of every element with this local name. */
export function allTags(xml: string, name: string): string[] {
  return [...xml.matchAll(tagRe(name))].map((m) => m[1] ?? "");
}

export const firstTag = (xml: string, name: string): string | null => allTags(xml, name)[0] ?? null;

/** The <href> inside a property, e.g. current-user-principal or calendar-home-set. */
export function hrefIn(xml: string, property: string): string | null {
  const prop = firstTag(xml, property);
  const href = prop ? firstTag(prop, "href") : null;
  return href ? decodeXml(href.trim()) : null;
}

export type DavCalendar = { href: string; name: string; color: string | null };

/** The calendars in a calendar home (Depth 1 PROPFIND) that hold events, not just tasks or reminders. */
export function parseCalendars(xml: string): DavCalendar[] {
  return allTags(xml, "response").flatMap((r) => {
    const href = firstTag(r, "href");
    const type = firstTag(r, "resourcetype") ?? "";
    if (!href || !/<(?:[\w-]+:)?calendar[\s/>]/i.test(type)) return [];
    const components = allTags(r, "comp").length ? [...r.matchAll(/<(?:[\w-]+:)?comp\s[^>]*name="([^"]+)"/gi)].map((m) => m[1].toUpperCase()) : ["VEVENT"];
    if (!components.includes("VEVENT")) return [];
    const name = decodeXml(firstTag(r, "displayname") ?? "").trim();
    const color = decodeXml(firstTag(r, "calendar-color") ?? "").trim() || null;
    return [{ href: decodeXml(href.trim()), name: name || "Naptár", color }];
  });
}

/** The iCal documents in a calendar-query REPORT reply. */
export function parseCalendarData(xml: string): string[] {
  return allTags(xml, "calendar-data")
    .map((d) => decodeXml(d).trim())
    .filter((d) => d.startsWith("BEGIN:VCALENDAR"));
}

const davTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A REPORT asking for the events that overlap [from, to). */
export function calendarQuery(from: Date, to: Date) {
  return `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${davTime(from)}" end="${davTime(to)}"/></c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;
}

/** The nearest of Flavio's calendar colours to a server colour like "#FF2968FF". */
export function nearestColor(hex: string | null, fallback: string): string {
  const m = hex?.match(/^#?([0-9a-f]{6})/i);
  if (!m) return fallback;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const palette: Record<string, [number, number, number]> = {
    sky: [14, 165, 233],
    violet: [139, 92, 246],
    amber: [245, 158, 11],
    rose: [244, 63, 94],
    emerald: [16, 185, 129],
    slate: [100, 116, 139],
  };
  let best = fallback;
  let bestDistance = Infinity;
  for (const [name, [pr, pg, pb]] of Object.entries(palette)) {
    const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [name, distance];
  }
  return best;
}
