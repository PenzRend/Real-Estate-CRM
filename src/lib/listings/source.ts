// Where an imported listing comes from: known portals, canonical listing
// addresses (so the same listing is recognised however it was linked) and
// what the import found. Pure functions, shared by the CRM and its tests.

export const LISTING_PORTALS: { host: string; name: string }[] = [
  { host: "ingatlan.com", name: "ingatlan.com" },
  { host: "jofogas.hu", name: "Jófogás" },
  { host: "otthonterkep.hu", name: "Otthontérkép" },
  { host: "ingatlanbazar.hu", name: "Ingatlanbazár" },
  { host: "ingatlannet.hu", name: "Ingatlannet" },
  { host: "alberlet.hu", name: "Albérlet.hu" },
];

export function portalOf(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return LISTING_PORTALS.find((p) => host === p.host || host.endsWith(`.${p.host}`)) ?? null;
}

/**
 * The stored form of a listing address: https, no tracking query or hash, and
 * for ingatlan.com just the listing id (https://ingatlan.com/34567890).
 * Null for anything that isn't an https listing page.
 */
export function canonicalListingUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const portal = portalOf(url);
  if (portal?.host === "ingatlan.com") {
    const id = url.pathname.match(/\/(\d{6,10})\/?$/)?.[1];
    return id ? `https://ingatlan.com/${id}` : null;
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const canonical = `https://${url.hostname.toLowerCase().replace(/^www\./, "")}${path}`;
  return canonical.length <= 500 ? canonical : null;
}

/** Portals that refuse page requests from servers (bot check); their pages are read in the agent's browser. */
export const SERVER_BLOCKED_PORTALS = ["ingatlan.com", "jofogas.hu"];

export function blocksServers(url: string) {
  try {
    return SERVER_BLOCKED_PORTALS.includes(portalOf(new URL(url))?.host ?? "");
  } catch {
    return false;
  }
}

/** "Importálás hirdetésből" accepts a page's text only if it looks like a listing, not an empty paste. */
export function looksLikeListingText(text: string) {
  const t = text.trim();
  return t.length >= 80 && /\d/.test(t);
}
