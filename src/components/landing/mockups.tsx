// Static product illustrations for the landing page. They mirror the real
// screens (capture review, assistant, matching) and are labelled "Példa".

import { Check, CircleDashed, Mic, Sparkles, X } from "lucide-react";
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
