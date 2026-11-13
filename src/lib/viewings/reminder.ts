// The day-before reminder to the client: when, where (with a map link) and
// the two buttons. Pure, so it is tested.

import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";

export type ReminderFacts = {
  clientName: string;
  startsAt: string;
  durationMinutes: number;
  propertyTitle: string;
  /** Where to go: the viewing's own meeting point, else the listing's address. */
  place: string | null;
  /** The client's page with the "I'll come" / "I can't come" buttons. */
  link: string;
  agentName: string;
  agentPhone: string | null;
};

/** A map search for the address (opens the map app on a phone). */
export const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

/**
 * The short confirmation an agent texts the client right after booking
 * (SMS or WhatsApp, from their own phone): when, where, and a map link.
 */
export function confirmationText(f: { clientName: string; startsAt: string; place: string | null }): string {
  const at = new Date(f.startsAt);
  const day = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", timeZone: DEFAULT_TIMEZONE }).format(at);
  const time = new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_TIMEZONE }).format(at);
  // Hungarian order: the first name is the last word.
  const first = f.clientName.trim().split(/\s+/).at(-1);
  const place = f.place?.trim();
  return [
    first ? `Kedves ${first}!` : "Jó napot!",
    // Hungarian house numbers end in a period ("tere 5."): no second one.
    `Megerősítem a megtekintést: ${day}, ${time}${place ? `, ${place}` : ""}`.replace(/\.?$/, "."),
    place ? `Térkép: ${mapsUrl(place)}` : null,
    "Ha közbejön valami, kérem, jelezze.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function reminderEmail(f: ReminderFacts): { subject: string; body: string } {
  const at = new Date(f.startsAt);
  const time = new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_TIMEZONE }).format(at);
  const day = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", timeZone: DEFAULT_TIMEZONE }).format(at);
  const lines = [
    `Kedves ${f.clientName}!`,
    "",
    `Emlékeztetőül: holnap (${day}) ${time}-kor találkozunk a megtekintésen.`,
    "",
    `Ingatlan: ${f.propertyTitle}`,
    ...(f.place ? [`Cím: ${f.place}`, `Térkép: ${mapsUrl(f.place)}`] : []),
    "",
    "Kérem, jelezze egy kattintással, hogy számíthatok-e Önre:",
    f.link,
    "",
    f.agentPhone ? `Ha késik vagy kérdése van, hívjon nyugodtan: ${f.agentPhone}` : "Ha késik vagy kérdése van, válaszoljon erre a levélre.",
    "",
    "Üdvözlettel:",
    f.agentName,
  ];
  return { subject: `Holnap ${time} – megtekintés: ${f.propertyTitle}`.slice(0, 300), body: lines.join("\n") };
}
