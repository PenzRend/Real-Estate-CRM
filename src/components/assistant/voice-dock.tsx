"use client";

import { ArrowUpRight, Check, Loader2, Mic, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useVoiceCommand } from "./use-voice-command";
import { OPEN_ASSISTANT_EVENT, VOICE_ANSWER_EVENT, VOICE_ASK_EVENT, type VoiceAnswer, type VoiceAsk } from "./voice-event";

const BARS = 32;

type Stage = { kind: "thinking"; text: string } | { kind: "done"; answer: string } | { kind: "error"; message: string } | null;

/** The answer as one plain line: no source marks, no markdown. */
function plain(answer: string) {
  const text = answer
    .replace(/\[S\d+\]/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 170 ? `${text.slice(0, 168).trimEnd()}…` : text;
}

/**
 * "Mondd Flaviónak" in the menu on a computer: it opens up where it is, shows
 * the voice as it listens, then hands the words to the assistant (which works
 * with its panel closed) and takes the agent to the page that shows the
 * result. An answer to read or a step to approve opens the panel instead.
 */
export function VoiceDock() {
  const [stage, setStage] = useState<Stage>(null);
  const voice = useVoiceCommand((text) => {
    setStage({ kind: "thinking", text });
    window.dispatchEvent(new CustomEvent<VoiceAsk>(VOICE_ASK_EVENT, { detail: { text } }));
  });

  useEffect(() => {
    const onAnswer = (e: Event) => {
      const r = (e as CustomEvent<VoiceAnswer>).detail;
      if (!r.ok) setStage({ kind: "error", message: r.error });
      else if (r.href) setStage({ kind: "done", answer: plain(r.answer) });
      else setStage(null); // the panel opened with the answer
    };
    window.addEventListener(VOICE_ANSWER_EVENT, onAnswer);
    return () => window.removeEventListener(VOICE_ANSWER_EVENT, onAnswer);
  }, []);

  // A finished request folds back after a while; an error stays a little longer.
  const settled = stage?.kind === "done" || stage?.kind === "error" || voice.error ? (stage?.kind ?? "error") : null;
  useEffect(() => {
    if (!settled) return;
    const t = setTimeout(
      () => {
        setStage(null);
        voice.clearError();
      },
      settled === "done" ? 8000 : 9000,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearError is stable in effect
  }, [settled]);

  const listening = voice.state === "listening";
  const transcribing = voice.state === "transcribing";
  const thinking = stage?.kind === "thinking";
  const error = voice.error ?? (stage?.kind === "error" ? stage.message : null);
  const open = listening || transcribing || stage != null || error != null;

  function close() {
    if (listening) voice.cancel();
    setStage(null);
    voice.clearError();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (voice.state === "listening") voice.cancel();
      setStage(null);
      voice.clearError();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, voice]);

  function begin() {
    setStage(null);
    voice.clearError();
    void voice.start();
  }

  const title = listening
    ? "Hallgatlak…"
    : transcribing
      ? "Leírom…"
      : thinking
        ? "Dolgozom rajta…"
        : stage?.kind === "done"
          ? "Megnyitottam"
          : error
            ? "Nem sikerült"
            : "Mondd Flaviónak";
  const bars = Array.from({ length: BARS }, (_, i) => voice.levels[voice.levels.length - BARS + i] ?? 0);

  return (
    <div
      className={cn(
        "flavio-cta overflow-hidden text-white transition-[border-radius] duration-300",
        open ? "rounded-[1.6rem] hover:translate-y-0" : "rounded-full",
      )}
    >
      {open ? (
        <div className="flex h-12 items-center gap-2.5 pr-2 pl-1.5">
          <span
            className={cn("relative grid size-9 shrink-0 place-items-center rounded-full bg-accent transition-transform duration-100", stage?.kind === "done" && "bg-success", error && "bg-danger")}
            style={listening ? { transform: `scale(${1 + voice.level * 0.25})` } : undefined}
          >
            {stage?.kind === "done" ? <Check className="size-4" /> : error ? <X className="size-4" /> : transcribing || thinking ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium" aria-live="polite">
            {title}
          </span>
          <button type="button" onClick={close} className="grid size-8 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label={listening ? "Mégse" : "Bezárás"}>
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={begin}
          title="Mondd el, mi történt vagy mit tegyen – például: „beszéltem Kiss Annával, 3 szobást keres”"
          aria-label="Mondd Flaviónak"
          className="group flex h-12 w-full items-center gap-2.5 pr-4 pl-1.5 text-sm font-medium"
        >
          <span className="flavio-cta-mic relative grid size-9 shrink-0 place-items-center rounded-full bg-accent">
            <Mic className="size-4 transition-transform group-hover:scale-110" />
          </span>
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="flex items-center gap-1">
              Mondd Flaviónak <Sparkles className="size-3.5 text-[#9db8ff]" />
            </span>
            <span className="truncate text-[11px] font-normal text-white/60">Hívás, ügyfél, teendő – bármi</span>
          </span>
        </button>
      )}

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0">
          <div className="flex flex-col gap-3 px-3.5 pt-1 pb-3.5">
            {(listening || transcribing || thinking) && (
              <div className="flex h-10 items-center justify-between gap-[2px]" aria-hidden>
                {bars.map((l, i) => (
                  <span
                    key={i}
                    className={cn("w-full rounded-full bg-white/85", !listening && "voice-wave bg-white/40")}
                    style={listening ? { height: `${Math.max(3, Math.min(40, 3 + l * 44))}px`, transition: "height 120ms linear" } : { animationDelay: `${(i % 16) * 70}ms` }}
                  />
                ))}
              </div>
            )}

            {listening && (
              <>
                <p className="text-[11px] leading-snug text-white/60">Mondd, mit csináljak – például „Mutasd Kiss Anna adatlapját” vagy „Írj fel egy feladatot holnap 10-re”.</p>
                <button type="button" onClick={() => voice.stop()} className="h-9 rounded-full bg-white text-sm font-medium text-ink hover:bg-white/90">
                  Kész, mehet
                </button>
              </>
            )}

            {thinking && <p className="line-clamp-3 text-xs leading-snug text-white/75 italic">„{stage.text}”</p>}

            {stage?.kind === "done" && (
              <>
                {stage.answer && <p className="line-clamp-4 text-xs leading-snug text-white/80">{stage.answer}</p>}
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
                    setStage(null);
                  }}
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[#9db8ff] hover:text-white"
                >
                  Teljes válasz <ArrowUpRight className="size-3.5" />
                </button>
              </>
            )}

            {error && (
              <>
                <p className="text-xs leading-snug text-white/80">{error}</p>
                <button type="button" onClick={begin} className="h-9 rounded-full bg-white/10 text-sm font-medium hover:bg-white/15">
                  Újra
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
