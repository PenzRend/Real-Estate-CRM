// Opens the CRM's import page with what the popup or the hand-off collected.
// The listing's data travels in the address fragment, which browsers never
// send to a server. Its photos are downloaded here, in the agent's browser
// (only from photo servers the agent allowed), and passed to the CRM tab's
// bridge script, which keeps them in that tab's storage for the import.

const DEFAULT_CRM = "http://localhost:3000";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Same as the CRM's canonicalListingUrl (src/lib/listings/source.ts), so both name the listing alike. */
function canonical(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "ingatlan.com" || host.endsWith(".ingatlan.com")) {
      const id = url.pathname.match(/\/(\d{6,10})\/?$/);
      return id ? `https://ingatlan.com/${id[1]}` : null;
    }
    return `https://${host}${url.pathname.replace(/\/+$/, "") || "/"}`;
  } catch {
    return null;
  }
}

function base64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function tabLoaded(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}

/**
 * True once the agent allows downloads from this photo server. The popup asks
 * right after sending the listing, so the answer may still be on its way.
 */
async function allowed(origin, waitMs) {
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  if (!waitMs) return false;
  return new Promise((resolve) => {
    const onAdded = (p) => {
      if (p.origins?.includes(origin)) done(true);
    };
    const done = (v) => {
      chrome.permissions.onAdded.removeListener(onAdded);
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done(false), waitMs);
    chrome.permissions.onAdded.addListener(onAdded);
  });
}

async function sendImages(tabId, source, images) {
  const answered = new Map();
  for (const url of images) {
    let message = { type: "crm-image", source, url, ok: false };
    try {
      const origin = `${new URL(url).origin}/*`;
      if (!answered.has(origin)) answered.set(origin, await allowed(origin, 60_000));
      if (answered.get(origin)) {
        const res = await fetch(url, { credentials: "omit" });
        const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const buffer = res.ok && IMAGE_TYPES.includes(type) ? await res.arrayBuffer() : null;
        if (buffer && buffer.byteLength <= MAX_IMAGE_BYTES) message = { ...message, ok: true, mime: type, data: base64(buffer) };
      }
    } catch {
      // left as not downloaded; the CRM shows it as unavailable
    }
    await chrome.tabs.sendMessage(tabId, message).catch(() => undefined);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "open-crm" || typeof message.fragment !== "string") return;
  if (!/^import=[A-Za-z0-9_-]+$/.test(message.fragment)) return;
  // Confirms receipt, so the sender can show "sent".
  sendResponse({ ok: true });
  void (async () => {
    const { crmUrl } = await chrome.storage.sync.get({ crmUrl: DEFAULT_CRM });
    const tab = await chrome.tabs.create({ url: `${crmUrl}/properties/import#${message.fragment}`, index: sender.tab ? sender.tab.index + 1 : undefined });
    const images = Array.isArray(message.images) ? message.images.filter((u) => typeof u === "string").slice(0, 60) : [];
    const source = canonical(message.source || "");
    if (!images.length || !source || !tab.id) return;
    // Started from the CRM (not the popup): nobody has asked about the photo
    // servers yet, so ask in a small window of the extension's own.
    if (sender.tab) {
      const origins = [...new Set(images.map((u) => `${new URL(u).origin}/*`))].slice(0, 5);
      const missing = [];
      for (const o of origins) if (!(await chrome.permissions.contains({ origins: [o] }))) missing.push(o);
      if (missing.length) {
        const query = missing.map((o) => `origin=${encodeURIComponent(o)}`).join("&");
        await chrome.windows.create({ url: `permission.html?${query}`, type: "popup", width: 440, height: 260 });
      }
    }
    await tabLoaded(tab.id);
    await sendImages(tab.id, source, images);
  })();
});
