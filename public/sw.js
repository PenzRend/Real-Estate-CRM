// Flavio's service worker: shows notifications (a new inquiry, a client
// writing) and opens the right page when one is tapped. It does not cache
// pages; Flavio always shows live data.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Flavio", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Flavio", {
      body: data.body || "",
      icon: "/app-icon/192",
      badge: "/app-icon/badge-96",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // An open Flavio window goes to the page; otherwise a new one opens.
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
