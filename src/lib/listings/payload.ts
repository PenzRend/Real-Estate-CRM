// What the browser extension hands to the CRM's import page, in the address
// fragment (#import=…): never sent to any server, read once by the page.

export type ListingPayload = {
  kind: "listing";
  url: string;
  text: string;
  structured?: string | null;
  /** Photo addresses on the page; the extension downloads them separately. */
  images?: string[];
  videos?: string[];
};
export type ProfilePayload = {
  kind: "profile";
  source: string;
  listings: { url: string; title: string | null; detail: string | null }[];
};
export type ImportPayload = ListingPayload | ProfilePayload;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

/** Decodes and validates a payload; anything malformed is ignored. */
export function decodePayload(fragment: string): ImportPayload | null {
  const m = fragment.match(/^#?import=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  let data: unknown;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.kind === "listing") {
    const url = str(d.url, 2000);
    const text = str(d.text, 60_000);
    const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => str(x, 2000)).filter((x): x is string => Boolean(x)).slice(0, max) : []);
    return url && text ? { kind: "listing", url, text, structured: str(d.structured, 20_000), images: list(d.images, 60), videos: list(d.videos, 20) } : null;
  }
  if (d.kind === "profile" && Array.isArray(d.listings)) {
    const listings = d.listings
      .slice(0, 200)
      .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>) : {}))
      .map((l) => ({ url: str(l.url, 2000) ?? "", title: str(l.title, 300), detail: str(l.detail, 300) }))
      .filter((l) => l.url);
    return { kind: "profile", source: str(d.source, 2000) ?? "", listings };
  }
  return null;
}

/** The inverse, used by the extension (and tests). */
export function encodePayload(p: ImportPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `import=${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
