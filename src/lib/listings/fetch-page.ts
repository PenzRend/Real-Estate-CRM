import "server-only";
import { isBotCheckPage, pageImages, pageText, pageVideoLinks, robotsDisallows, structuredData } from "./html";
import { portalOf } from "./source";

// Opens a listing page from its link, for portals that serve pages to
// servers. One request per user action, identifying itself, respecting
// robots.txt, never getting around a bot check: a blocked portal is reported
// so the import can continue in the agent's own browser.

const USER_AGENT = "IngatlanCRM/0.1 (listing import on behalf of a signed-in agent)";
const MAX_BYTES = 3 * 1024 * 1024;

export type FetchedPage =
  | { ok: true; text: string; structured: string | null; images: string[]; videos: string[] }
  | { ok: false; reason: "not_portal" | "blocked" | "robots" | "failed" };

/** Only https pages of known portals (or their subdomains); never other hosts. */
export function fetchableUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.port && !u.username && portalOf(u) ? u : null;
  } catch {
    return null;
  }
}

async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Follows up to three redirects, each one checked against the portal list. */
export async function portalFetch(url: URL, accept: string) {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(current, { headers: { "User-Agent": USER_AGENT, Accept: accept }, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = fetchableUrl(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }
    return res;
  }
  return null;
}

const robotsCache = new Map<string, { text: string; at: number }>();

export async function robotsAllow(url: URL) {
  const cached = robotsCache.get(url.origin);
  let text = cached && Date.now() - cached.at < 3_600_000 ? cached.text : null;
  if (text == null) {
    try {
      const res = await fetch(`${url.origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(5000) });
      text = res.ok ? (await res.text()).slice(0, 200_000) : "";
    } catch {
      text = "";
    }
    robotsCache.set(url.origin, { text, at: Date.now() });
  }
  return !robotsDisallows(text, url.pathname);
}

export async function fetchListingPage(raw: string): Promise<FetchedPage> {
  const url = fetchableUrl(raw);
  if (!url) return { ok: false, reason: "not_portal" };
  if (!(await robotsAllow(url))) return { ok: false, reason: "robots" };
  try {
    const res = await portalFetch(url, "text/html,application/xhtml+xml");
    if (!res) return { ok: false, reason: "failed" };
    const html = await readCapped(res);
    if (isBotCheckPage(res.status, html, res.headers)) return { ok: false, reason: "blocked" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const text = pageText(html).slice(0, 60_000);
    return { ok: true, text, structured: structuredData(html), images: pageImages(html, url.toString()), videos: pageVideoLinks(html, url.toString()) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
