"use client";

import { Loader2, PenLine, PlugZap, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { analyzeCaptureAction, type AnalyzeResult } from "@/app/(app)/interactions/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { Option } from "@/lib/db/activity";
import { CaptureReview } from "./capture-review";
import { ManualInteractionForm } from "./manual-interaction-form";
import { VoiceRecorder } from "./voice-recorder";

const EXAMPLE =
  "Pl.: Beszéltem Péterrel. 2 hálós lakást keres a XI. kerületben, kb. 80 millióig, 3 hónapon belül költözne. Küldjek neki megfelelő ingatlanokat, pénteken hívjam vissza.";

export function CaptureWorkspace({
  clients,
  properties,
  defaults,
  aiEnabled,
  transcriptionEnabled,
}: {
  clients: Option[];
  properties: Option[];
  defaults: { clientId?: string; propertyId?: string; type?: string };
  aiEnabled: boolean;
  transcriptionEnabled: boolean;
}) {
  const [mode, setMode] = useState<"ai" | "manual">(aiEnabled ? "ai" : "manual");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Extract<AnalyzeResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, startAnalyzing] = useTransition();

  function analyze() {
    setError(null);
    startAnalyzing(async () => {
      const r = await analyzeCaptureAction({ text, clientId: defaults.clientId ?? null });
      if (r.ok) setResult(r);
      else setError(r.error);
    });
  }

  if (result) {
    return (
      <CaptureReview
        transcript={text.trim()}
        extraction={result.extraction}
        candidates={result.candidates}
        properties={properties}
        initialPropertyId={defaults.propertyId}
        pinnedClientId={defaults.clientId}
        onBack={() => setResult(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Rögzítés módja" className="flex w-fit gap-1 rounded-full border border-border p-1">
        {[
          { key: "ai" as const, label: "Gyors rögzítés AI-val", icon: Sparkles },
          { key: "manual" as const, label: "Kézi rögzítés", icon: PenLine },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors",
              mode === key ? "bg-primary font-medium text-white" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === "manual" ? (
        <ManualInteractionForm clients={clients} properties={properties} defaults={defaults} />
      ) : !aiEnabled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-soft px-5 py-4 text-sm text-warning">
          <PlugZap className="mt-0.5 size-4 shrink-0" />
          <p>
            Az AI-szolgáltatás még nincs beállítva, ezért most csak kézzel lehet rögzíteni. A beállításhoz kell egy
            AI-kulcs a szerveren (lásd a projekt dokumentációját).
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border-strong bg-background p-2 shadow-float focus-within:border-ink">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              aria-label="Jegyzet"
              className="min-h-56 border-0 shadow-none focus:border-0"
              disabled={analyzing}
            />
            <div className="flex flex-col gap-3 border-t border-border p-2 pt-3 sm:flex-row sm:items-start sm:justify-between">
              {transcriptionEnabled ? (
                <VoiceRecorder
                  disabled={analyzing}
                  onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${t}` : t))}
                />
              ) : (
                <p className="text-xs text-muted">Diktáláshoz használd a telefon billentyűzetének mikrofon gombját.</p>
              )}
              <Button size="lg" onClick={analyze} disabled={analyzing || !text.trim()}>
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {analyzing ? "Feldolgozás…" : "Feldolgozás"}
              </Button>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <p className="text-xs text-muted">
            Az AI kigyűjti az ügyfél igényeit, a határidőket és a teendőket. Mentés előtt mindent látsz és javíthatsz.
            A hangfelvételt nem tároljuk, csak a leírt szöveget.
          </p>
        </div>
      )}
    </div>
  );
}
