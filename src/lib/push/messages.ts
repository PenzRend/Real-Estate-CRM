// What a notification says. Pure, so it is tested.

import type { PushMessage } from "./server";

export type ArrivalLike = { fromName: string | null; fromEmail: string | null; subject: string | null; portal: string | null; fromClient: boolean };

const who = (a: ArrivalLike) => a.fromName || a.fromEmail || "Ismeretlen feladó";

/**
 * New mail since the last check: a portal inquiry or a client's email gets its
 * own notification (sender and subject); several at once become one summary.
 * The notification opens the dashboard, where the reply draft is waiting.
 */
export function arrivalsMessage(arrivals: ArrivalLike[]): PushMessage | null {
  if (!arrivals.length) return null;
  if (arrivals.length === 1) {
    const a = arrivals[0];
    const title = a.portal ? `Új érdeklődés · ${a.portal}` : a.fromClient ? `Új levél: ${who(a)}` : `Új levél: ${who(a)}`;
    const body = a.portal ? `${who(a)}: ${a.subject ?? "(nincs tárgy)"}` : (a.subject ?? "(nincs tárgy)");
    return { title, body: `${body} – a válaszvázlat a Flavióban vár.`, url: "/dashboard", tag: "new-mail" };
  }
  const inquiries = arrivals.filter((a) => a.portal).length;
  const parts = [inquiries && `${inquiries} új érdeklődés`, arrivals.length - inquiries && `${arrivals.length - inquiries} új levél`].filter(Boolean);
  const names = [...new Set(arrivals.map(who))].slice(0, 3).join(", ");
  return { title: parts.join(" és "), body: `${names}${arrivals.length > 3 ? " és mások" : ""} – nézd meg a Flavióban.`, url: "/dashboard", tag: "new-mail" };
}
