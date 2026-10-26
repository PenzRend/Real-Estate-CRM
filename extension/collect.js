// Reads the page the agent is looking at, in their own browser. Defines
// functions only; nothing runs until the popup or the CRM hand-off calls them.
// Not tied to a portal's exact markup: the visible text, any structured data,
// photos and links are enough for the CRM's AI to fill the form.

(() => {
  const LISTING_PATH = /\/(\d{6,10})\/?$/;
  const SKIP_IMAGE = /logo|icon|sprite|avatar|placeholder|banner|badge|favicon|pixel|tracking|\.svg(\?|$)/i;
  const VIDEO_HOST = /^(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|my\.matterport\.com|kuula\.co)$/i;
  const host = (h) => h.toLowerCase().replace(/^www\./, "");

  // Image-resizing addresses ("/_next/image?url=…") wrap the full-size original.
  const unwrap = (u) => {
    const inner = u.searchParams.get("url");
    if (inner && (/\/_next\/image\/?$|\/image\/?$|\/img\/?$/.test(u.pathname) || /^https?:\/\//.test(inner))) {
      try {
        return new URL(inner, u);
      } catch {
        return u;
      }
    }
    return u;
  };

  const absolute = (src) => {
    try {
      const u = unwrap(new URL(src, location.href));
      return u.protocol === "https:" ? u.href : null;
    } catch {
      return null;
    }
  };

  const largest = (srcset) => {
    let best = null;
    for (const part of (srcset || "").split(",")) {
      const [url, size] = part.trim().split(/\s+/);
      const n = parseFloat(size || "1") || 1;
      if (url && (!best || n > best.n)) best = { url, n };
    }
    return best ? best.url : null;
  };

  function structured() {
    return [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => s.textContent.trim())
      .join("\n")
      .slice(0, 20000);
  }

  /** Pixel area from a size in the address ("/1920x1080/"), 0 when there is none. */
  const sizeOf = (u) => {
    const m = u.match(/\/(\d{2,4})x(\d{2,4})(?=\/|$)/);
    return m ? Number(m[1]) * Number(m[2]) : 0;
  };

  /**
   * Which photo an address shows, so its thumbnail, full-size and share-card
   * versions count once. Image servers often put the file key in an encoded
   * last segment ({"key":"…/35529931_1.jpg",…}); otherwise the address minus
   * its size segment and query.
   */
  const identity = (u) => {
    try {
      const url = new URL(u);
      const last = url.pathname.split("/").pop() || "";
      try {
        const data = JSON.parse(atob(last.replace(/-/g, "+").replace(/_/g, "/")));
        if (data && typeof data.key === "string") return `${url.host}|${data.key}`;
      } catch {
        // not an encoded key
      }
      return url.host + url.pathname.replace(/\/\d{2,4}x\d{2,4}(?=\/)/, "");
    } catch {
      return u;
    }
  };

  /** Galleries kept as JSON in data attributes ([{"type":"image","url":…}, …]): every address in them. */
  function galleryJsonUrls() {
    const found = [];
    const walk = (v) => {
      if (typeof v === "string") {
        if (/^https:\/\//.test(v)) found.push(v);
      } else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        // Skip entries that say they are something other than a photo (e.g. videos, banners).
        if (typeof v.type === "string" && !/image|photo|kep/i.test(v.type)) return;
        Object.values(v).forEach(walk);
      }
    };
    for (const el of document.querySelectorAll("*")) {
      for (const a of el.attributes) {
        const value = a.value;
        if (!a.name.startsWith("data-") || value.length < 30 || !/^\s*[[{]/.test(value) || !value.includes("http")) continue;
        try {
          walk(JSON.parse(value));
        } catch {
          // not JSON
        }
      }
    }
    return found.filter((u) => !/\.(css|js|json|svg|html?)(\?|$)/i.test(u));
  }

  /**
   * Listing photos, gallery first, each photo once in its largest version:
   * gallery JSON, structured data, og:image, then large images in the main content.
   */
  function images() {
    const best = new Map();
    const add = (src) => {
      const url = src && absolute(src);
      if (!url || SKIP_IMAGE.test(url)) return;
      const m = url.match(/\/(\d{2,4})x(\d{2,4})(?=\/|$)/);
      // Explicitly tiny versions are thumbnails; their large version is elsewhere.
      if (m && Math.max(Number(m[1]), Number(m[2])) < 400) return;
      const id = identity(url);
      const prev = best.get(id);
      if (!prev) {
        if (best.size < 60) best.set(id, url);
      } else if (sizeOf(url) > sizeOf(prev)) best.set(id, url);
    };
    galleryJsonUrls().forEach(add);
    // A page's own gallery list is the authority: nothing else on the page
    // (agent portrait, office logo, ads, other listings) is a photo of this listing.
    if (best.size) return [...best.values()];
    const walk = (v) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (!v || typeof v !== "object") return;
      for (const [k, val] of Object.entries(v)) {
        if (k === "image" || k === "photo" || k === "contentUrl") [val].flat().forEach((x) => add(typeof x === "string" ? x : x && x.url));
        else walk(val);
      }
    };
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        walk(JSON.parse(s.textContent));
      } catch {
        // not JSON
      }
    }
    document.querySelectorAll('meta[property="og:image"], meta[property="og:image:url"]').forEach((m) => add(m.content));
    const root = document.querySelector("main") || document.body;
    root.querySelectorAll("img, source").forEach((el) => {
      const srcset = el.getAttribute("srcset") || el.getAttribute("data-srcset");
      const src = largest(srcset) || el.getAttribute("data-src") || el.getAttribute("data-lazy") || el.currentSrc || el.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      // Loaded small images are thumbnails or UI; lazy gallery images may not be loaded yet.
      if (el.tagName === "IMG" && el.naturalWidth && el.naturalWidth < 400 && !srcset) return;
      add(src);
    });
    return [...best.values()];
  }

  function videos() {
    const out = new Set();
    for (const el of document.querySelectorAll("iframe[src], a[href]")) {
      const url = absolute(el.getAttribute("src") || el.getAttribute("href"));
      if (url && VIDEO_HOST.test(new URL(url).hostname) && out.size < 10) out.add(url);
    }
    return [...out];
  }

  function listing() {
    const ld = structured();
    const root = document.querySelector("main") || document.body;
    const text = root.innerText
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 60000);
    return { kind: "listing", url: location.href.split("#")[0], text, structured: ld || null, images: images(), videos: videos() };
  }

  /** Listing links on a profile or results page, one per listing, with the card's first lines. */
  function profile() {
    const here = host(location.hostname);
    const found = new Map();
    const thumbs = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      let u;
      try {
        u = new URL(a.href);
      } catch {
        continue;
      }
      if (host(u.hostname) !== here || !LISTING_PATH.test(u.pathname)) continue;
      const url = `https://${here}${u.pathname.replace(/\/+$/, "")}`;
      const card = a.closest("article, li, [class*='card'], [class*='listing']") || a;
      const img = card.querySelector("img");
      const thumb = img && absolute(img.currentSrc || img.getAttribute("src") || "");
      if (thumb) thumbs.add(thumb);
      const lines = card.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
      const prev = found.get(url);
      if (prev && prev.size >= lines.length) continue;
      found.set(url, {
        url,
        title: (a.innerText.trim() || lines[0] || "").slice(0, 300) || null,
        detail: lines.slice(0, 4).join(" · ").slice(0, 300) || null,
        size: lines.length,
      });
    }
    return {
      kind: "profile",
      source: location.href.split("#")[0],
      listings: [...found.values()].slice(0, 200).map((l) => ({ url: l.url, title: l.title, detail: l.detail })),
      // Not sent to the CRM: tells the popup which photo servers the listings use.
      thumbs: [...thumbs].slice(0, 20),
    };
  }

  /** "auto": a listing page by its address, otherwise the listings linked from the page. */
  globalThis.__crmCollect = (mode = "auto") => {
    if (mode === "listing") return listing();
    if (mode === "profile") return profile();
    return LISTING_PATH.test(location.pathname) ? listing() : profile();
  };

  /** Same encoding as the CRM's src/lib/listings/payload.ts. */
  globalThis.__crmEncode = (payload) => {
    const { thumbs, ...data } = payload;
    void thumbs;
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return `import=${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  };
})();
