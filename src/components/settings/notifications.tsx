"use client";

import { Bell, BellOff, Loader2, Share, Smartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { removePushAction, savePushAction, testPushAction } from "@/app/(app)/settings/push-actions";
import { Button } from "@/components/ui/button";

type Status = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** The VAPID public key as the bytes the push manager wants. */
function keyBytes(base64url: string) {
  const padded = (base64url + "===".slice((base64url.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  const os = /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : /mac/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : "Eszköz";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "böngésző";
  return `${os} · ${browser}`;
}

/**
 * Notifications on this device: a new portal inquiry or a client's email
 * arrives as a phone notification within a couple of minutes. On an iPhone,
 * Flavio has to be added to the home screen first (Apple's rule).
 */
export function NotificationsSetting({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const done = (s: Status) => !cancelled && setStatus(s);
    (async () => {
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return done(isIos() && !isInstalled() ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return done("denied");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      done(existing ? "on" : "off");
    })().catch(() => done("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enable = () =>
    start(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) });
        const json = sub.toJSON();
        const r = await savePushAction({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", device: deviceName() });
        if (!r.ok) {
          await sub.unsubscribe().catch(() => undefined);
          setMessage(r.error);
          return;
        }
        setStatus("on");
        setMessage("Bekapcsolva ezen az eszközön. Küldj egy próbát!");
      } catch {
        setMessage("Az értesítéseket nem sikerült bekapcsolni ezen az eszközön.");
      }
    });

  const disable = () =>
    start(async () => {
      setMessage(null);
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await removePushAction(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setStatus("off");
    });

  const test = () =>
    start(async () => {
      const r = await testPushAction().catch(() => ({ ok: false as const, error: "Nem sikerült elküldeni." }));
      setMessage(r.ok ? "Elküldve – pár másodperc, és megjelenik." : r.error);
    });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:col-span-2">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted">
          <Bell className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Értesítés új érdeklődésről</p>
          <p className="mt-0.5 text-sm text-muted">
            Ha portálos érdeklődés vagy ügyféllevél érkezik, pár percen belül jelez a telefonod – a válaszvázlat már kész vár a Flavióban. Aki elsőként válaszol, az
            nyeri meg az ügyfelet.
          </p>
        </div>
      </div>

      {status === "ios-install" && (
        <div className="flex gap-3 rounded-xl bg-surface p-3 text-sm text-text">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>
            iPhone-on előbb tedd ki a Flaviót a Főképernyőre: Safariban a <Share className="inline size-3.5" /> Megosztás gomb → <b>Főképernyőhöz adás</b>. Utána
            nyisd meg onnan, és itt kapcsold be az értesítéseket.
          </p>
        </div>
      )}
      {status === "unsupported" && <p className="text-sm text-muted">Ez a böngésző nem tud értesítést fogadni. Próbáld Chrome-ban, Edge-ben vagy a telefonodon.</p>}
      {status === "denied" && (
        <p className="text-sm text-warning">
          Az értesítések le vannak tiltva ennél a böngészőnél. Engedélyezd a böngésző címsora melletti lakat ikonnál (Webhely-beállítások → Értesítések), majd
          töltsd újra az oldalt.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "checking" && <Loader2 className="size-4 animate-spin text-muted" />}
        {status === "off" && (
          <Button size="sm" onClick={enable} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Bell />} Bekapcsolás ezen az eszközön
          </Button>
        )}
        {status === "on" && (
          <>
            <span className="text-sm font-medium text-success">Bekapcsolva ezen az eszközön</span>
            <Button size="sm" variant="secondary" onClick={test} disabled={busy}>
              Próba-értesítés
            </Button>
            <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
              <BellOff /> Kikapcsolás
            </Button>
          </>
        )}
        {message && (
          <p role="status" className="text-sm text-muted">
            {message}
          </p>
        )}
      </div>
      <p className="text-xs text-subtle">Minden eszközön (telefon, laptop) külön kell bekapcsolni.</p>
    </div>
  );
}
