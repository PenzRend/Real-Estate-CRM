// Reading a listing page's HTML on the server: visible text, structured data,
// photos and video links. Pure string functions (no DOM on the server), shared
// with tests. Only used for portals that serve pages to servers.

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

/** The page's readable text: scripts, styles and markup removed, block elements as new lines. */
export function pageText(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html;
  return decodeEntities(
    main
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/dt|\/dd)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ldBlocks(html: string) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
}

export function structuredData(html: string): string | null {
  const blocks = ldBlocks(html);
  return blocks.length ? blocks.join("\n").slice(0, 20_000) : null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|$)/i;
const SKIP_IMAGE = /logo|icon|sprite|avatar|placeholder|banner|badge|favicon|pixel|tracking|\.svg(\?|$)/i;

/**
 * Image-resizing addresses wrap the real photo ("/_next/image?url=…&w=640");
 * the original is the full-size file.
 */
export function unwrapImageProxy(url: URL): URL {
  const inner = url.searchParams.get("url");
  if (inner && (/\/_next\/image\/?$|\/image\/?$|\/img\/?$/.test(url.pathname) || /^https?:\/\//.test(inner))) {
    try {
      return new URL(inner, url);
    } catch {
      return url;
    }
  }
  return url;
}

function absolute(src: string, base: string) {
  try {
    const u = unwrapImageProxy(new URL(decodeEntities(src.trim()), base));
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The largest candidate in a srcset ("a.jpg 640w, b.jpg 1280w" → b.jpg). */
export function largestFromSrcset(srcset: string) {
  let best: { url: string; size: number } | null = null;
  for (const part of srcset.split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const n = parseFloat(size ?? "1") || 1;
    if (!best || n > best.size) best = { url, size: n };
  }
  return best?.url ?? null;
}

function ldImages(blocks: string[]): string[] {
  const found: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (k === "image" || k === "photo" || k === "contentUrl") {
          for (const x of [val].flat()) {
            if (typeof x === "string") found.push(x);
            else if (x && typeof x === "object" && typeof (x as { url?: unknown }).url === "string") found.push((x as { url: string }).url);
          }
        } else walk(val);
      }
    }
  };
  // Each <script> block whole: pretty-printed JSON spans many lines.
  for (const block of blocks) {
    try {
      walk(JSON.parse(block));
    } catch {
      // malformed block; skip
    }
  }
  return found;
}

/** Listing photos: structured data and og:image first, then large-looking <img>/<source> files. */
export function pageImages(html: string, baseUrl: string, max = 60): string[] {
  const out = new Map<string, true>();
  const add = (src: string | null | undefined) => {
    if (!src) return;
    const url = absolute(src, baseUrl);
    if (url && !SKIP_IMAGE.test(url) && out.size < max) out.set(url, true);
  };
  ldImages(ldBlocks(html)).forEach(add);
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/property=["']og:image(?::url)?["']/i.test(m[0])) add(m[0].match(/content=["']([^"']+)["']/i)?.[1]);
  }
  for (const tag of html.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const t = tag[0];
    const attr = (name: string) => t.match(new RegExp(`\\s${name}=["']([^"']+)["']`, "i"))?.[1];
    const srcset = attr("srcset") ?? attr("data-srcset");
    const src = (srcset && largestFromSrcset(srcset)) ?? attr("data-src") ?? attr("data-lazy") ?? attr("src");
    if (!src || src.startsWith("data:")) continue;
    // Small fixed sizes are UI images, not photos.
    const w = Number(attr("width"));
    if (w && w < 300) continue;
    // Judged on the real file address (resizer addresses unwrapped).
    const real = absolute(src, baseUrl);
    if (real && (IMAGE_EXT.test(real) || /\/(images?|photos?|kepek|foto|ingatlan)\//i.test(new URL(real).pathname))) add(real);
  }
  return [...out.keys()];
}

const VIDEO_HOSTS = /^(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|my\.matterport\.com|kuula\.co)$/i;

/** Video and virtual-tour links (YouTube, Vimeo, Matterport…), as on the page. */
export function videoLinks(urls: string[]): string[] {
  const out = new Set<string>();
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" && VIDEO_HOSTS.test(u.hostname)) out.add(u.toString());
    } catch {
      // not a URL
    }
    if (out.size >= 10) break;
  }
  return [...out];
}

export function pageVideoLinks(html: string, baseUrl: string) {
  const urls = [...html.matchAll(/<(?:iframe|a)\b[^>]*\s(?:src|href)=["']([^"']+)["']/gi)].map((m) => absolute(m[1], baseUrl)).filter(Boolean) as string[];
  return videoLinks(urls);
}

/** Cloudflare and similar "checking your browser" pages instead of the listing. */
export function isBotCheckPage(status: number, html: string, headers: { get(name: string): string | null }) {
  if (headers.get("cf-mitigated") === "challenge") return true;
  if (status === 403 || status === 429 || status === 503) return true;
  const title = html.match(/<title>([^<]*)/i)?.[1] ?? "";
  return /just a moment|attention required|gyors ellenőrzés|checking your browser/i.test(title);
}

/** Minimal robots.txt check for the "*" group: is this path disallowed? */
export function robotsDisallows(robots: string, path: string): boolean {
  let applies = false;
  const rules: { allow: boolean; path: string }[] = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) applies = value === "*";
    else if (applies && /^(dis)?allow$/i.test(key) && value) rules.push({ allow: /^allow$/i.test(key), path: value });
  }
  // "*" matches anything, a trailing "$" anchors the end.
  const match = (rule: string) => {
    const anchored = rule.endsWith("$");
    const body = anchored ? rule.slice(0, -1) : rule;
    const escaped = body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`^${escaped.join(".*")}${anchored ? "$" : ""}`).test(path);
  };
  const hit = rules.filter((r) => match(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return Boolean(hit && !hit.allow);
}
