// A viewing day on the road: today's viewings in order with a map link for
// each and for the whole route, the "running late" text, and what the
// morning notification and the "Hogy sikerült?" prompt say. Pure, so it is
// tested.

export type DayViewing = { id: string; startsAt: string; durationMinutes: number; status: string; location: string | null; client: { name: string; phone: string | null }; property: { name: string; address: string | null } };

const budapestDay = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(d);
export const hhmm = (iso: string) => new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(new Date(iso));

/** Where to drive: the viewing's own place, else the listing's address. */
export const placeOf = (v: DayViewing) => (v.location ?? v.property.address ?? "").trim();

/** Today's scheduled viewings (Budapest day), earliest first. */
export function todaysViewings<T extends DayViewing>(viewings: T[], now: Date): T[] {
  const today = budapestDay(now);
  return viewings.filter((v) => v.status === "scheduled" && budapestDay(new Date(v.startsAt)) === today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export type MapsApp = "apple" | "google" | "waze";
export type LatLng = { lat: number; lng: number };

/** The address as a map search reads it: notes in brackets ("(teszt)", "(kapukód 12)") left out. */
export const mapQuery = (place: string) => place.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

/** The places of the day still ahead, in order. */
export const stopsAhead = (viewings: DayViewing[], now: Date) =>
  viewings.filter((v) => new Date(v.startsAt).getTime() + v.durationMinutes * 60_000 > now.getTime()).map(placeOf).filter(Boolean);

/**
 * Directions in the chosen app, from where the agent is now when the phone
 * told us (otherwise the app's own location). Google takes the whole day as
 * waypoints (up to 9); Apple Maps and Waze go to the first stop.
 */
export function navigationUrl(app: MapsApp, stops: string[], origin: LatLng | null): string {
  const places = stops.map(mapQuery).filter(Boolean);
  const from = origin ? `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}` : null;
  if (app === "apple") {
    const q = new URLSearchParams({ daddr: places[0] ?? "", dirflg: "d" });
    if (from) q.set("saddr", from);
    return `https://maps.apple.com/?${q}`;
  }
  if (app === "waze") return `https://waze.com/ul?q=${encodeURIComponent(places[0] ?? "")}&navigate=yes`;
  const destination = places[places.length - 1] ?? "";
  const waypoints = places.slice(0, -1).slice(0, 9);
  return (
    `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from}` : ""}&destination=${encodeURIComponent(destination)}` +
    (waypoints.length ? `&waypoints=${waypoints.map(encodeURIComponent).join("%7C")}` : "") +
    "&travelmode=driving"
  );
}

/** The whole day as one route: the stops still ahead, in order (Google allows up to 9 waypoints). */
export function dayRoute(viewings: DayViewing[], now: Date): string | null {
  const stops = viewings.filter((v) => new Date(v.startsAt).getTime() + v.durationMinutes * 60_000 > now.getTime()).map(placeOf).filter(Boolean);
  if (stops.length < 2) return null;
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).slice(0, 9);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${waypoints.map(encodeURIComponent).join("%7C")}&travelmode=driving`;
}

/** The text for "Késem": polite, with the agent's name. */
export function lateText(agent: string | null, minutes = 10) {
  return `Jó napot! Kb. ${minutes} perc késéssel érkezem a megtekintésre, elnézést kérek!${agent ? ` – ${agent}` : ""}`;
}

/** The SMS link with the text filled in (iPhone and Android both read "?&body="). */
export function smsLink(phone: string, body: string) {
  return `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
}

/** The 7:00 notification: today's viewings and tasks in one line; null on a day with neither. */
export function morningMessage(viewings: DayViewing[], tasks: number): { title: string; body: string } | null {
  if (!viewings.length && !tasks) return null;
  const parts: string[] = [];
  if (viewings.length) {
    const first = viewings[0];
    const where = placeOf(first).split(",")[0];
    parts.push(`${viewings.length} megtekintés, az első ${hhmm(first.startsAt)}${where ? ` – ${where}` : ""}`);
  }
  if (tasks) parts.push(`${tasks} teendő`);
  return { title: "Jó reggelt! Ma:", body: parts.join(" · ") };
}
