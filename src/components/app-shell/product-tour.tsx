"use client";

import { ArrowLeft, ArrowRight, AudioLines, BellRing, Building2, Inbox, Mic, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { finishTourAction } from "@/app/(app)/tour-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// The welcome walkthrough: what Flavio does and where it is, in six short
// steps. Shown once to a new user; Settings can open it again.

export const TOUR_EVENT = "flavio:open-tour";

const STEPS: { icon: typeof Mic; title: string; text: string; where: string }[] = [
  {
    icon: Sparkles,
    title: "Üdv a Flavióban!",
    text: "A Flavio leveszi rólad a gépelést: a hívásokból ügyféladat és teendő lesz, az érdeklődők maguktól bekerülnek, és mindig látod, kit kell felhívnod. Egy perc, és megmutatjuk, mi hol van.",
    where: "",
  },
  {
    icon: Mic,
    title: "Rögzítés: mondd el a hívást",
    text: "Hívás vagy megtekintés után nyomd meg, és mondd el pár mondatban, mi történt. Az AI kitölti az ügyfelet, a keresését és a teendőt, te pedig mezőnként jóváhagyod. Semmi nem mentődik a tudtod nélkül.",
    where: "Bal oldalt (telefonon fent) a fekete Rögzítés gomb.",
  },
  {
    icon: AudioLines,
    title: "Mondd Flaviónak",
    text: "Kérdezz vagy kérj valamit, szóban vagy írásban: „Kiket kell ma visszahívnom?”, „Írj fel egy feladatot holnap 10-re”. Csak a te adataidból válaszol, és megmutatja, honnan tudja.",
    where: "A Mondd Flaviónak gomb, vagy a jobb alsó sarokban lévő buborék.",
  },
  {
    icon: Building2,
    title: "Ügyfelek, ingatlanok, párosítás",
    text: "Az ingatlant elég a hirdetés linkjéből importálni. Minden ügyfélnél látod, melyik ingatlan illik hozzá és miért, és egy kattintással megírja az ajánló levelet.",
    where: "Ügyfelek és Ingatlanok a menüben.",
  },
  {
    icon: Inbox,
    title: "Levelek",
    text: "Kösd össze a Gmailt vagy az Outlookot: a portálos érdeklődések és az ügyfeleid levelei az ügyfélhez kerülnek, és válaszvázlatot is kérhetsz. Küldeni csak a te kattintásodra küld.",
    where: "Levelek a menüben.",
  },
  {
    icon: BellRing,
    title: "Semmi nem csúszik el",
    text: "Az Áttekintésen reggel látod a mai teendőket, a lejárt visszahívásokat és a megtekintéseket. Kapcsold be az értesítéseket, és tedd ki a Flaviót a telefonod kezdőképernyőjére.",
    where: "Áttekintés a menüben; értesítések a Beállításokban.",
  },
];

export function ProductTour({ show }: { show: boolean }) {
  const [open, setOpen] = useState(show);
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  // Settings → "Bemutató" opens it again.
  useEffect(() => {
    const reopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, reopen);
    return () => window.removeEventListener(TOUR_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const close = () => {
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      onClose={() => {
        setOpen(false);
        // Closing at any step counts: it is not shown again unless asked for.
        void finishTourAction().catch(() => {});
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
      aria-label="Bemutató"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface text-ink">
            <s.icon className="size-6" />
          </span>
          <button type="button" onClick={close} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Bemutató bezárása">
            <X className="size-4" />
          </button>
        </div>
        <div key={step} className="reveal flex flex-col gap-2">
          <h2 className="text-xl">{s.title}</h2>
          <p className="text-[15px] text-text">{s.text}</p>
          {s.where && <p className="text-sm text-muted">Hol: {s.where}</p>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={`${step + 1}. lépés / ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-ink" : "w-1.5 bg-border-strong")} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="size-4" /> Vissza
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={close}>
                Kihagyom
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? close() : setStep(step + 1))}>
              {last ? "Kezdjük" : "Tovább"} {!last && <ArrowRight className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** For Settings: opens the walkthrough again. */
export function ReopenTourButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
      <Sparkles className="size-4" /> Bemutató újra
    </Button>
  );
}
