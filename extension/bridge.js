// Runs on the CRM's own pages. Tells the CRM the extension is installed, and
// keeps photos the extension downloaded for an import in this site's browser
// storage (IndexedDB), where the CRM's import picks them up. Same database,
// store and key format as src/lib/listings/pending-media.ts.

(() => {
  // Marks the page, and keeps the mark if the page's own scripts redraw <html>.
  const mark = () => {
    if (document.documentElement.dataset.crmExtension !== "1") document.documentElement.dataset.crmExtension = "1";
  };
  mark();
  new MutationObserver(mark).observe(document.documentElement, { attributes: true, attributeFilter: ["data-crm-extension"] });
  document.addEventListener("DOMContentLoaded", mark);

  // Answers the CRM page's "is the extension here?" question.
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data?.type === "crm-extension-ping") window.postMessage({ type: "crm-extension-pong", version: chrome.runtime.getManifest().version }, location.origin);
  });

  const DB = "crm-import";
  const STORE = "images";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "crm-image" || typeof message.source !== "string" || typeof message.url !== "string") return;
    if (!message.ok) {
      window.postMessage({ type: "crm-import-image", url: message.url, ok: false }, location.origin);
      return;
    }
    void (async () => {
      const bytes = Uint8Array.from(atob(message.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: message.mime });
      const db = await openDb();
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(blob, `${message.source}|${message.url}`);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
      // Let the import screen refresh its previews.
      window.postMessage({ type: "crm-import-image", url: message.url, ok: true }, location.origin);
    })();
  });
})();
