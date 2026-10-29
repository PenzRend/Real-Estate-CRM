import "server-only";
import { publicHostProblem } from "@/lib/net/public-host";
import { calendarQuery, hrefIn, parseCalendarData, parseCalendars, type DavCalendar } from "./caldav-xml";

// CalDAV, the calendar protocol of iCloud (and Fastmail, Nextcloud, Zoho…):
// finding the agent's calendars with their Apple ID and an app password, and
// reading events in a time range. Read only; Flavio never changes them.

export const ICLOUD_CALDAV = "https://caldav.icloud.com/";

export class CalDavError extends Error {
  constructor(
    message: string,
    readonly auth = false,
  ) {
    super(message);
  }
}

type Login = { username: string; password: string };

const MAX_BYTES = 10_000_000;

/** One WebDAV request: public hosts only, redirects followed by hand (each re-checked), size- and time-limited. */
async function dav(url: string, login: Login, method: "PROPFIND" | "REPORT", depth: 0 | 1, body: string): Promise<{ url: string; text: string }> {
  let target = new URL(url);
  for (let hop = 0; hop < 5; hop++) {
    if (target.protocol !== "https:") throw new CalDavError("A naptárszerver csak titkosított (https) kapcsolattal érhető el.");
    const problem = await publicHostProblem(target.hostname);
    if (problem) throw new CalDavError(problem);
    const res = await fetch(target, {
      method,
      redirect: "manual",
      headers: {
        Authorization: `Basic ${Buffer.from(`${login.username}:${login.password}`).toString("base64")}`,
        Depth: String(depth),
        "Content-Type": "application/xml; charset=utf-8",
      },
      body,
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {
      throw new CalDavError("A naptárszerver nem érhető el.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      target = new URL(res.headers.get("location")!, target);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new CalDavError("A naptárszerver elutasította a belépést. Ellenőrizd az Apple ID-t és az alkalmazásjelszót.", true);
    if (res.status !== 207 && !res.ok) throw new CalDavError(`A naptárszerver hibát adott (${res.status}).`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new CalDavError("A naptár túl nagy.");
    return { url: target.toString(), text };
  }
  throw new CalDavError("A naptárszerver túl sokszor irányított át.");
}

const PRINCIPAL = `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`;
const HOME = `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`;
const LIST = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">
  <d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/><a:calendar-color/></d:prop>
</d:propfind>`;

/** The agent's event calendars, with absolute addresses: server → their principal → calendar home → calendars. */
export async function discoverCalendars(server: string, login: Login): Promise<DavCalendar[]> {
  const root = await dav(server, login, "PROPFIND", 0, PRINCIPAL);
  const principal = hrefIn(root.text, "current-user-principal");
  if (!principal) throw new CalDavError("Ez a szerver nem naptárszerver (CalDAV).");
  const principalUrl = new URL(principal, root.url).toString();
  const homeReply = await dav(principalUrl, login, "PROPFIND", 0, HOME);
  const home = hrefIn(homeReply.text, "calendar-home-set");
  if (!home) throw new CalDavError("A naptárak nem találhatók ezen a szerveren.");
  const homeUrl = new URL(home, homeReply.url).toString();
  const list = await dav(homeUrl, login, "PROPFIND", 1, LIST);
  return parseCalendars(list.text).map((c) => ({ ...c, href: new URL(c.href, list.url).toString() }));
}

/** The iCal documents of the events in [from, to); repeating ones come whole and are expanded by the reader. */
export async function calendarEventsIcs(calendarUrl: string, login: Login, from: Date, to: Date): Promise<string[]> {
  const r = await dav(calendarUrl, login, "REPORT", 1, calendarQuery(from, to));
  return parseCalendarData(r.text);
}
