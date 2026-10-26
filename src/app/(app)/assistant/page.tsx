import { ArrowUp, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/badge";

export const metadata: Metadata = { title: "AI-asszisztens" };

const examples = [
  "Kiket kell ma utánkövetnem?",
  "Foglald össze a legutóbbi beszélgetéseimet Péterrel.",
  "Mely aktív ingatlanok illenek a 70–90 M Ft-os vevőkhöz?",
  "Mely feladataim jártak le?",
];

export default function AssistantPage() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Eyebrow>AI-asszisztens</Eyebrow>
        <h1 className="mt-5 text-[34px] leading-tight sm:text-[44px] sm:tracking-[-0.05em]">
          Kérdezz az ügyfeleidről
        </h1>
        <p className="mt-3 max-w-md text-muted">
          Csak a saját munkaterületed adataiból válaszol, és megmutatja, melyik bejegyzésre támaszkodik.
        </p>

        <div className="mt-10 grid w-full gap-2 sm:grid-cols-2">
          {examples.map((q) => (
            <button
              key={q}
              type="button"
              className="rounded-2xl border border-border p-4 text-left text-sm text-text transition-colors hover:border-border-strong hover:bg-surface"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <form className="sticky bottom-4 mt-10">
        <div className="flex items-end gap-2 rounded-3xl border border-border-strong bg-background p-2 pl-5 shadow-float focus-within:border-ink">
          <Sparkles className="mb-3 size-4 shrink-0 text-accent" />
          <textarea
            name="question"
            rows={1}
            placeholder="Kérdezz bármit az ügyfeleidről, ingatlanaidról, feladataidról…"
            aria-label="Kérdés az AI-asszisztensnek"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-ink placeholder:text-subtle focus:outline-none"
          />
          <button
            type="submit"
            disabled
            aria-label="Küldés"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          Az asszisztens a 2. fázisban kapcsol be, amikor az AI-szolgáltató be van állítva.
        </p>
      </form>
    </div>
  );
}
