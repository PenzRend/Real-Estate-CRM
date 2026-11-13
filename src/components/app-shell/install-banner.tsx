"use client";

import { Share, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

// On a phone, in the browser: "put Flavio on your home screen" – Android's own
// install prompt, or the two iPhone steps – then notifications in Beállítások.
// Never on a computer, never once installed; "Később" hides it for two weeks.
// Shown on the overview only.

const KEY = "flavio:install-hidden-until";
const CHANGED = "flavio:install-banner";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}
/** "ios" | "android" | null (don't show). */
function platform(): "ios" | "android" | null {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  try {
    if (Number(localStorage.getItem(KEY) ?? 0) > Date.now()) return null;
  } catch {
    // Storage blocked: show it.
  }
  const ua = navigator.userAgent;
  if (/iphone|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua) && /mobile/i.test(ua)) return "android";
  return null;
}

export function InstallBanner() {
  const pathname = usePathname();
  const kind = useSyncExternalStore(subscribe, platform, () => null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  // Chrome on Android offers its own install dialog; keep it for the button.
  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);

  // Only on the overview: on every page it would take a fifth of a phone screen.
  if (!kind || pathname !== "/dashboard") return null;
  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + 14 * 86_400_000));
    } catch {
      // Not kept: it shows again next time.
    }
    window.dispatchEvent(new Event(CHANGED));
  };

  return (
    <div className="reveal mb-6 flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent-soft/40 p-4 lg:hidden">
      <Smartphone className="mt-0.5 size-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-ink">Tedd ki a Flaviót a telefonod kezdőképernyőjére</p>
        {kind === "ios" ? (
          <p className="mt-1 text-text">
            Safariban a <Share className="inline size-3.5 align-text-bottom" /> Megosztás gomb → <b>Főképernyőhöz adás</b>. Onnan megnyitva úgy működik, mint egy app, és{" "}
            <Link href="/settings#ertesitesek" className="font-medium underline">
              értesítést is kaphatsz
            </Link>{" "}
            az új érdeklődőkről.
          </p>
        ) : (
          <p className="mt-1 text-text">
            Egy koppintás, és úgy működik, mint egy app – az új érdeklődőkről pedig{" "}
            <Link href="/settings#ertesitesek" className="font-medium underline">
              értesítést kapsz
            </Link>
            .
          </p>
        )}
        {kind === "android" && prompt && (
          <button
            type="button"
            onClick={async () => {
              await prompt.prompt();
              const { outcome } = await prompt.userChoice;
              if (outcome === "accepted") later();
              setPrompt(null);
            }}
            className="mt-2.5 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-white"
          >
            Telepítés
          </button>
        )}
      </div>
      <button type="button" onClick={later} aria-label="Később" title="Később" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-background">
        <X className="size-4" />
      </button>
    </div>
  );
}
