"use client";

import { AudioLines, Building2, Check, Inbox, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { VOICE_EVENT } from "@/components/assistant/voice-event";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { FirstStep } from "@/lib/onboarding/first-steps";

// "Első lépések": what a new agent does first, one line each, with the one
// button that does it. Hidden once everything is done, or until tomorrow
// when the agent says "Később".

const KEY = "flavio:first-steps-hidden-until";

const content: Record<FirstStep["id"], { title: string; why: string; icon: typeof Building2; action: { label: string; href?: string; voice?: boolean }; alt?: { label: string; href: string } }> = {
  property: {
    title: "Vedd fel az első ingatlanodat",
    why: "Elég bemásolni a hirdetés linkjét: a fotók és az adatok maguktól bekerülnek.",
    icon: Building2,
    action: { label: "Importálás linkből", href: "/properties/import" },
    alt: { label: "Kézzel", href: "/properties/new" },
  },
  client: {
    title: "Add hozzá az első ügyfeledet",
    why: "Hívás után nyomd meg a Rögzítést, és mondd el, mit beszéltetek – Flavio kitölti az adatlapot.",
    icon: UserPlus,
    action: { label: "Rögzítés", href: "/interactions/new" },
    alt: { label: "Űrlappal", href: "/clients/new" },
  },
  mailbox: {
    title: "Kösd össze a postafiókodat",
    why: "A portálos érdeklődések és az ügyfelek levelei maguktól az ügyfélhez kerülnek.",
    icon: Inbox,
    action: { label: "Összekapcsolás", href: "/inbox" },
  },
  assistant: {
    title: "Kérj meg Flaviót valamire",
    why: "Például: „írj fel egy feladatot holnap 10-re: visszahívni Kiss Annát”. Mondhatod hangosan is.",
    icon: AudioLines,
    action: { label: "Mondd Flaviónak", voice: true },
  },
  team: {
    title: "Hívd meg a kollégáidat",
    why: "Közös ügyfelek, ingatlanok és dokumentumok, csevegés és az iroda számai.",
    icon: Users,
    action: { label: "Meghívás", href: "/settings" },
  },
};

const CHANGED = "flavio:first-steps";
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function hiddenNow() {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) > Date.now();
  } catch {
    return false; // storage blocked: just show it
  }
}

export function FirstSteps({ steps }: { steps: FirstStep[] }) {
  // Hidden on the server and until the browser has said whether "Később" was pressed.
  const hidden = useSyncExternalStore(subscribe, hiddenNow, () => true);

  const required = steps.filter((s) => !s.optional);
  const left = required.filter((s) => !s.done).length;
  if (hidden || left === 0) return null;

  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + 24 * 3600_000));
    } catch {
      // Not kept: it shows again on the next visit.
    }
    window.dispatchEvent(new Event(CHANGED));
  };
  const next = steps.find((s) => !s.done);

  return (
    <section aria-label="Első lépések" className="reveal rounded-3xl border border-accent/25 bg-accent-soft/30 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium tracking-tight text-ink">Első lépések</h2>
          <p className="mt-0.5 text-sm text-muted">
            {required.length - left} / {required.length} kész · pár perc az egész, és utána Flavio magától dolgozik neked.
          </p>
        </div>
        <button type="button" onClick={later} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted hover:bg-background hover:text-ink">
          <X className="size-3.5" /> Később
        </button>
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        {steps.map((s) => {
          const c = content[s.id];
          const Icon = c.icon;
          const current = s === next;
          return (
            <li key={s.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5 sm:flex-nowrap", current ? "bg-background shadow-sm" : "")}>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", s.done ? "bg-success text-white" : "bg-background text-accent")}>
                {s.done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", s.done ? "text-muted line-through" : "text-ink")}>
                  {c.title}
                  {s.optional && !s.done && <span className="ml-1.5 text-xs font-normal text-subtle">(ha csapatban dolgozol)</span>}
                </span>
                {current && <span className="mt-0.5 block text-xs text-muted">{c.why}</span>}
              </span>
              {!s.done && (
                <span className="flex shrink-0 items-center gap-2">
                  {c.alt && current && (
                    <Link href={c.alt.href} className="text-xs text-muted hover:text-ink">
                      {c.alt.label}
                    </Link>
                  )}
                  {c.action.voice ? (
                    <button type="button" onClick={() => window.dispatchEvent(new Event(VOICE_EVENT))} className={buttonClasses(current ? "primary" : "secondary", "sm")}>
                      {c.action.label}
                    </button>
                  ) : (
                    <Link href={c.action.href!} className={buttonClasses(current ? "primary" : "secondary", "sm")}>
                      {c.action.label}
                    </Link>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
