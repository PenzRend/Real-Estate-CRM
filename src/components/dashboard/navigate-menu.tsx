"use client";

import { Check, Loader2, Navigation, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { navigationUrl, type LatLng, type MapsApp } from "@/lib/viewings/day";

const APPS: { app: MapsApp; label: string }[] = [
  { app: "apple", label: "Apple Térkép" },
  { app: "google", label: "Google Térkép" },
  { app: "waze", label: "Waze" },
];
const KEY = "flavio:maps-app";

function remembered(): MapsApp | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "apple" || v === "google" || v === "waze" ? v : null;
  } catch {
    return null;
  }
}

/**
 * "Navigáció" (one stop) or "Teljes útvonal" (the day): a choice of Apple
 * Térkép, Google Térkép or Waze, the last one used on top. The route starts
 * where the agent is: the phone's location is asked for when the menu opens.
 */
export function NavigateMenu({ stops, variant = "stop" }: { stops: string[]; variant?: "stop" | "route" }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [last, setLast] = useState<MapsApp | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setLast(remembered());
    if (next &&!origin && !locating && "geolocation" in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude });
          setLocating(false);
        },
        () => setLocating(false),
        { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 8000 },
      );
    }
  }

  const apps = last ? [...APPS].sort((a, b) => Number(b.app === last) - Number(a.app === last)) : APPS;
  const many = variant === "route" && stops.length > 1;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          variant === "route"
            ? "inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent"
            : "inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-ink hover:bg-surface"
        }
      >
        {variant === "route" ? <Route className="size-4" /> : <Navigation className="size-3.5" />}
        {variant === "route" ? "Teljes útvonal" : "Navigáció"}
      </button>
      {open && (
        <div role="menu" className={cn("absolute z-20 mt-1.5 w-60 rounded-2xl border border-border bg-background p-1.5 shadow-float", variant === "route" ? "right-0" : "left-0")}>
          <p className="flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-[11px] text-muted">
            {locating ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Helyzeted keresése…
              </>
            ) : origin ? (
              "Indulás: ahol most vagy"
            ) : (
              "Indulás: a térkép saját helymeghatározása"
            )}
          </p>
          {apps.map(({ app, label }) => (
            <a
              key={app}
              role="menuitem"
              href={navigationUrl(app, stops, origin)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                try {
                  localStorage.setItem(KEY, app);
                } catch {
                  // Private mode: nothing to remember.
                }
                setOpen(false);
              }}
              className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm text-ink hover:bg-surface"
            >
              <span>
                {label}
                {many && <span className="block text-[11px] text-muted">{app === "google" ? "minden megálló" : "csak a következő címig"}</span>}
              </span>
              {app === last && <Check className="size-3.5 text-muted" aria-label="legutóbb használt" />}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
