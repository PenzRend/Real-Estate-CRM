"use client";

import { Pause, Play } from "lucide-react";
import { useState, type ComponentType } from "react";
import { AssistantMock, CaptureMock, MailMock, MatchMock, PipelineMock, RouteMock } from "@/components/landing/mockups";
import { cn } from "@/lib/cn";

const SLIDES: { title: string; text: string; Mock: ComponentType<{ className?: string }> }[] = [
  { title: "Mondd el, és kész", text: "Egy hívás után elmondod, mi történt; Flavio felveszi az ügyfelet, a keresését és a teendőt.", Mock: CaptureMock },
  { title: "Melyik ingatlan kinek való", text: "Minden párosításnál látod, mi stimmel és mi nem – nem kell fejben tartanod.", Mock: MatchMock },
  { title: "Kérdezz bármit", text: "Az asszisztens a saját adataidból válaszol, forrással. Szerződést és feladatot is elkészít.", Mock: AssistantMock },
  { title: "Válasz egy kattintással", text: "A portálos érdeklődésekre a naptárad alapján megírja a választ; te csak elküldöd.", Mock: MailMock },
  { title: "Hol tart minden ügyfeled", text: "Az értékesítési tölcsérben egy pillantással látod, kivel mi a következő lépés.", Mock: PipelineMock },
  { title: "A nap útvonala", text: "A mai megtekintések sorban, navigációval és egy „Késem” üzenettel, ha kell.", Mock: RouteMock },
];

const EVERY_MS = 6000;

/**
 * The payment page's look at what Flavio does: one screen at a time. The
 * current bar fills over six seconds and its end turns the page, so a pause
 * (the pointer or the keyboard on it, or the button) freezes the bar where it
 * is and it carries on from there. With less motion preferred the screens
 * swap without sliding.
 */
export function FeatureShowcase() {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);

  return (
    <section
      aria-roledescription="diavetítés"
      aria-label="Amit a Flavio tud"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="flex flex-col gap-5"
    >
      {/* Every screen in the same cell of a fixed-height box: a tall one fades out at the bottom, and nothing below jumps. */}
      <div className="relative grid h-[22rem] items-start overflow-hidden rounded-2xl bg-surface px-4 pt-6 sm:h-[25rem] sm:px-10 sm:pt-8">
        {SLIDES.map(({ title, Mock }, i) => (
          <div
            key={title}
            aria-hidden={i !== at}
            className={cn(
              "[grid-area:1/1] transition-[opacity,transform] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:transition-opacity",
              i === at ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
            )}
          >
            <Mock className="mx-auto max-w-md" />
          </div>
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface" />
      </div>

      <div className="grid">
        {SLIDES.map(({ title, text }, i) => (
          <div key={title} aria-hidden={i !== at} className={cn("[grid-area:1/1] transition-opacity duration-500", i === at ? "opacity-100" : "pointer-events-none opacity-0")}>
            <h2 className="text-xl leading-tight">{title}</h2>
            <p className="mt-1.5 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {SLIDES.map(({ title }, i) => (
            <button
              key={title}
              type="button"
              onClick={() => setAt(i)}
              aria-label={`${i + 1}. ${title}`}
              aria-current={i === at}
              className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong"
            >
              <span
                key={i === at ? `on-${at}` : "off"}
                className={cn("absolute inset-y-0 left-0 rounded-full bg-ink", i < at && "w-full", i === at && "showcase-progress", i > at && "w-0")}
                style={i === at ? { animationDuration: `${EVERY_MS}ms`, animationPlayState: held || paused ? "paused" : "running" } : undefined}
                onAnimationEnd={i === at ? () => setAt((n) => (n + 1) % SLIDES.length) : undefined}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Lejátszás" : "Megállítás"}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
      </div>
    </section>
  );
}
