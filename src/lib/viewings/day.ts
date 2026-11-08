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

/** Google Maps directions to one place (opens the app on a phone). */
export const directionsTo = (place: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}&travelmode=driving`;

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
