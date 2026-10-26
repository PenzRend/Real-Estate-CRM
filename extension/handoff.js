// When the CRM opens one of your listings for import (address ends in
// #crm-import), read it once it has rendered and send it back to the CRM,
// photos included. On every other ingatlan.com page this does nothing.
//
// The portal may first show its "checking your browser" page and then reload
// into the listing. The request is therefore remembered for this tab (session
// storage) until the real listing has been read, not just until the first load.

(() => {
  const KEY = "crm-import-requested";
  const MAX_AGE_MS = 3 * 60_000;
  const LISTING_PATH = /\/(\d{6,10})\/?$/;

  if (location.hash === "#crm-import") {
    sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, at: Date.now() }));
    history.replaceState(null, "", location.pathname + location.search);
  }
  let request;
  try {
    request = JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    request = null;
  }
  if (!request || Date.now() - request.at > MAX_AGE_MS || request.path !== location.pathname) return;

  // A small status badge, so it is visible what the extension is doing.
  const badge = document.createElement("div");
  badge.style.cssText =
    "position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:320px;padding:10px 14px;border-radius:12px;background:#1b1b1b;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
  const show = (text) => {
    badge.textContent = `Ingatlan CRM: ${text}`;
    if (!badge.isConnected) document.documentElement.appendChild(badge);
  };

  const isBotCheck = () => /gyors ellenőrzés|just a moment|checking your browser|attention required/i.test(document.title);
  const ready = () => LISTING_PATH.test(location.pathname) && (document.querySelector("main") || document.body).innerText.trim().length > 300;

  const started = Date.now();
  show("a hirdetés beolvasása…");
  const wait = setInterval(() => {
    // The portal's check page reloads by itself; this script runs again then.
    if (isBotCheck()) return show("a portál ellenőrzi a böngészőt, várok…");
    if (!ready()) {
      if (Date.now() - started < 15_000) return;
      clearInterval(wait);
      sessionStorage.removeItem(KEY);
      return show("nem találtam hirdetést ezen az oldalon. Nyisd meg a hirdetést, és használd a bővítmény gombját.");
    }
    clearInterval(wait);
    sessionStorage.removeItem(KEY);
    const payload = globalThis.__crmCollect("listing");
    chrome.runtime
      .sendMessage({ type: "open-crm", fragment: globalThis.__crmEncode(payload), source: payload.url, images: payload.images })
      .then(() => {
        show(`elküldve a CRM-nek (${payload.images.length} fotó). Az ellenőrzés új lapon nyílik.`);
        setTimeout(() => badge.remove(), 6000);
      })
      .catch(() => show("nem sikerült elküldeni. Töltsd újra a bővítményt a chrome://extensions oldalon."));
  }, 500);
})();
