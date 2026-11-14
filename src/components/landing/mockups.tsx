// Static product illustrations for the landing page and the payment page.
// They mirror the real screens and are labelled "Példa".

import { CalendarClock, Check, CircleDashed, Mail, Mic, Navigation, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function Frame({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-background shadow-float", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] tracking-wide text-subtle uppercase">Példa</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function CaptureMock({ className }: { className?: string }) {
  const fields: [string, string, boolean][] = [
    ["Ügyfél", "Kovács Anna · új érdeklődő", true],
    ["Keresett", "2–3 szobás lakás, XI. kerület", true],
    ["Keret", "60–70 M Ft", true],
    ["Fontos", "erkély, parkolás", true],
    ["Teendő", "Megtekintés szervezése · kedd 15:00", true],
    ["Megjegyzés", "Hitelre vásárol", false],
  ];
  return (
    <Frame title="Rögzítés · hívás után" className={className}>
      <div className="flex items-start gap-3 rounded-2xl bg-surface p-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-white">
          <Mic className="size-4" />
        </span>
        <p className="text-[13px] leading-relaxed text-muted">
          „Kovács Annával beszéltem, a tizenegyedikben keres két-három szobásat, hatvan-hetven millió között. Erkély és
          parkoló kell neki. Kedden háromkor megnéznénk…”
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[12px] font-medium text-accent">
        <Sparkles className="size-3.5" /> Az AI kitöltötte, te hagyod jóvá
      </div>
      <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
        {fields.map(([label, value, on]) => (
          <li key={label} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded border",
                on ? "border-primary bg-primary text-white" : "border-border-strong",
              )}
            >
              {on && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className="w-20 shrink-0 text-muted">{label}</span>
            <span className="min-w-0 truncate text-ink">{value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <span className="rounded-full border border-border-strong px-3.5 py-1.5 text-[12px] font-medium text-ink">Mégse</span>
        <span className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-medium text-white">Mentés</span>
      </div>
    </Frame>
  );
}

function Chip({ n }: { n: number }) {
  return (
    <span className="mx-0.5 inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent-soft px-1 align-text-top text-[10px] font-medium text-accent">
      {n}
    </span>
  );
}

export function AssistantMock({ className }: { className?: string }) {
  return (
    <Frame title="AI-asszisztens" className={className}>
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-[13px] text-white">
        Kiket kell ma visszahívnom?
      </div>
      <div className="mt-4 flex gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="size-3.5" />
        </span>
        <div className="rounded-2xl border border-border px-3.5 py-3 text-[13px] leading-relaxed text-text">
          Ma két utánkövetésed van:
          <ul className="mt-1.5 list-disc pl-4 marker:text-subtle">
            <li>
              <strong className="font-medium text-ink">Kovács Anna</strong> – megtekintés egyeztetése <Chip n={1} />
            </li>
            <li>
              <strong className="font-medium text-ink">Szabó Péter</strong> – ajánlat a Bartók Béla úti lakásra <Chip n={2} />
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5 text-[11px]">
            <span className="text-muted">Források:</span>
            <span className="rounded-full border border-border px-2 py-0.5">
              <span className="text-accent">1</span> Kovács Anna
            </span>
            <span className="rounded-full border border-border px-2 py-0.5">
              <span className="text-accent">2</span> Szabó Péter
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function MatchMock({ className }: { className?: string }) {
  const rows: [ReactNode, string, string][] = [
    [<Check key="c" className="size-3.5 text-success" />, "Ár", "64,9 M Ft – a keretben"],
    [<Check key="c" className="size-3.5 text-success" />, "Helyszín", "XI. kerület"],
    [<Check key="c" className="size-3.5 text-success" />, "Szobák", "3 szoba"],
    [<CircleDashed key="d" className="size-3.5 text-warning" />, "Erkély", "nincs adat a hirdetésben"],
    [<X key="x" className="size-3.5 text-danger" />, "Parkolás", "nincs"],
  ];
  return (
    <Frame title="Párosítás · indoklással" className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">Világos 3 szobás lakás, Bartók Béla út</p>
          <p className="text-[12px] text-muted">Kovács Anna kereséséhez</p>
        </div>
        <span className="shrink-0 rounded-full whitespace-nowrap bg-success-soft px-2.5 py-0.5 text-[11px] font-medium text-success">Jó egyezés</span>
      </div>
      <ul className="mt-4 grid gap-2">
        {rows.map(([icon, label, value]) => (
          <li key={label} className="flex items-center gap-2.5 text-[13px]">
            {icon}
            <span className="w-16 text-muted">{label}</span>
            <span className="text-ink">{value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <span className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-medium text-white">Ajánlom</span>
      </div>
    </Frame>
  );
}

export function PipelineMock({ className }: { className?: string }) {
  const columns: { name: string; dot: string; cards: [string, string, string][] }[] = [
    { name: "Megkeresve", dot: "bg-subtle", cards: [["NB", "Nagy Bence", "50–60 M Ft"]] },
    { name: "Aktív", dot: "bg-success", cards: [["KA", "Kovács Anna", "60–70 M Ft"], ["SP", "Szabó Péter", "max. 90 M Ft"]] },
    { name: "Tárgyalás", dot: "bg-warning", cards: [["TL", "Tóth Lili", "75 M Ft"]] },
  ];
  return (
    <Frame title="Értékesítési tölcsér" className={className}>
      <div className="grid grid-cols-3 gap-2">
        {columns.map((c) => (
          <div key={c.name} className="rounded-2xl border border-border bg-surface/40 p-1.5">
            <p className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-2 text-[11px] font-medium text-ink">
              <span className={cn("size-1.5 rounded-full", c.dot)} />
              {c.name}
            </p>
            <div className="grid gap-1.5">
              {c.cards.map(([ini, name, budget]) => (
                <div key={name} className={cn("rounded-xl border border-border bg-background p-2", name === "Szabó Péter" && "rotate-2 shadow-float")}>
                  <div className="flex items-center gap-1.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-strong text-[8px] font-semibold text-ink">{ini}</span>
                    <span className="truncate text-[11px] font-medium text-ink">{name}</span>
                  </div>
                  <span className="mt-1.5 inline-block rounded-full bg-surface px-1.5 py-0.5 text-[9px] text-ink">{budget}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">Húzd a kártyát a következő szakaszba</p>
    </Frame>
  );
}

export function MailMock({ className }: { className?: string }) {
  return (
    <Frame title="Levelek · válaszvázlat" className={className}>
      <div className="flex items-start gap-3 rounded-2xl border border-border p-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-strong text-ink">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0 text-[13px]">
          <p className="font-medium text-ink">Horváth Márta · ingatlan.com</p>
          <p className="mt-0.5 text-muted">„Érdekelne a Fehérvári úti lakás, megnézhetném a héten?”</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[12px] font-medium text-accent">
        <Sparkles className="size-3.5" /> Válaszvázlat, a naptárad alapján
      </div>
      <div className="mt-2 rounded-2xl bg-surface p-3.5 text-[13px] leading-relaxed text-text">
        Kedves Márta! Köszönöm az érdeklődést. Csütörtökön 17:00-kor vagy pénteken 10:00-kor tudom megmutatni a lakást. Melyik lenne jó?
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <span className="rounded-full border border-border-strong px-3.5 py-1.5 text-[12px] font-medium text-ink">Szerkesztés</span>
        <span className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-medium text-white">Küldés</span>
      </div>
    </Frame>
  );
}

export function RouteMock({ className }: { className?: string }) {
  const stops: [string, string, string][] = [
    ["10:00", "Kovács Anna", "XI. ker., Bartók Béla út"],
    ["13:30", "Szabó Péter", "XII. ker., Németvölgyi út"],
    ["17:00", "Tóth Lili", "II. ker., Pasaréti út"],
  ];
  return (
    <Frame title="Mai útvonal" className={className}>
      <ol className="grid gap-2">
        {stops.map(([time, name, place], i) => (
          <li key={time} className={cn("flex items-center gap-3 rounded-2xl border border-border p-3", i === 0 && "opacity-55")}>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink tabular-nums">
              <CalendarClock className="size-3" /> {time}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
              <span className="block truncate text-[11px] text-muted">{place}</span>
            </span>
            {i > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-ink">
                <Navigation className="size-3" /> Navigáció
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-[11px] text-muted">Apple Térkép, Google Térkép vagy Waze – onnan, ahol vagy</p>
    </Frame>
  );
}
