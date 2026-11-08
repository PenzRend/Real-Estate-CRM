"use client";

import { ArrowUp, Building2, Check, CheckSquare, Compass, FileSignature, FileText, Handshake, Loader2, Mail, MessageSquareText, Mic, RotateCcw, Sparkles, Square, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistantAction, confirmAssistantAction } from "@/app/(app)/assistant/actions";
import { toast } from "@/components/ui/toaster";
import type { Confirmation } from "@/lib/assistant/actions";
import { Eyebrow } from "@/components/ui/badge";
import { parseAnswer, type Inline } from "@/lib/assistant/format";
import type { Source, SourceType } from "@/lib/assistant/tools";
import { cn } from "@/lib/cn";
import { actionFailed } from "@/lib/action-failed";
import { useVoiceCommand } from "./use-voice-command";
import { VOICE_EVENT } from "./voice-event";

type Message = { role: "user"; content: string } | { role: "assistant"; content: string; sources: Source[]; confirmations: Confirmation[] };

const EXAMPLES = [
  "Kiket kell ma utánkövetnem?",
  "Írj fel egy feladatot holnap 10-re: ügyfeleket visszahívni",
  "Mely aktív ingatlanok illenek a vevőimhez?",
  "Készíts foglalási megállapodást a legutóbbi ügyletemhez",
];


const icons: Record<SourceType, typeof UserRound> = {
  client: UserRound,
  property: Building2,
  task: CheckSquare,
  interaction: MessageSquareText,
  email: Mail,
  page: Compass,
  document: FileText,
  contract: FileSignature,
  deal: Handshake,
};

/** A step the assistant prepared that reaches other people: runs only when the agent presses "Jóváhagyás". */
function ConfirmCard({ c }: { c: Confirmation }) {
  const [state, setState] = useState<"open" | "done" | "dismissed">("open");
  const [busy, start] = useTransition();
  const router = useRouter();
  if (state === "dismissed") return null;
  return (
    <div className={cn("pop-in rounded-2xl border p-3", state === "done" ? "border-success/30 bg-success-soft/40" : "border-accent/30 bg-accent-soft/40")}>
      <p className="text-sm font-medium text-ink">{c.label}</p>
      <p className="mt-0.5 text-xs text-muted">{c.detail}</p>
      {state === "done" ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
          <Check className="size-3.5" /> Kész
        </p>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await confirmAssistantAction(c.token).catch(actionFailed);
                if (!r.ok) {
                  toast({ message: r.error });
                  return;
                }
                setState("done");
                toast({ message: r.message });
                if (r.href) router.push(r.href);
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Jóváhagyás
          </button>
          <button type="button" disabled={busy} onClick={() => setState("dismissed")} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">
            <X className="size-3.5" /> Mégse
          </button>
        </div>
      )}
    </div>
  );
}

function Cite({ source, n }: { source: Source | undefined; n: number }) {
  if (!source) return null;
  return (
    <Link
      href={source.href}
      title={source.label}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1.5 align-text-top text-[11px] font-medium text-accent hover:bg-accent hover:text-white"
    >
      {n}
    </Link>
  );
}

function Parts({ parts, numberOf, sourceOf }: { parts: Inline[]; numberOf: (ref: string) => number; sourceOf: (ref: string) => Source | undefined }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <span key={i}>{p.text}</span>
        ) : p.kind === "bold" ? (
          <strong key={i} className="font-medium text-ink">{p.text}</strong>
        ) : (
          <Cite key={i} source={sourceOf(p.ref)} n={numberOf(p.ref)} />
        ),
      )}
    </>
  );
}

function Answer({ content, sources, confirmations }: { content: string; sources: Source[]; confirmations: Confirmation[] }) {
  const sourceOf = (ref: string) => sources.find((s) => s.ref === ref);
  const numberOf = (ref: string) => sources.findIndex((s) => s.ref === ref) + 1;
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-text">
      {parseAnswer(content).map((block, i) =>
        block.kind === "paragraph" ? (
          <p key={i}>
            <Parts parts={block.parts} numberOf={numberOf} sourceOf={sourceOf} />
          </p>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-subtle">
            {block.items.map((item, j) => (
              <li key={j}>
                <Parts parts={item} numberOf={numberOf} sourceOf={sourceOf} />
              </li>
            ))}
          </ul>
        ),
      )}
      {confirmations.map((c) => (
        <ConfirmCard key={c.token} c={c} />
      ))}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          <span className="text-xs text-muted">Források:</span>
          {sources.map((s, i) => {
            const Icon = icons[s.type];
            return (
              <Link
                key={s.ref}
                href={s.href}
                className="inline-flex max-w-64 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text hover:border-border-strong hover:bg-surface"
              >
                <span className="font-medium text-accent">{i + 1}</span>
                <Icon className="size-3 shrink-0 text-muted" />
                <span className="truncate">{s.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The chat. `compact` fits it into the corner panel: own scroll area, smaller welcome. */
export function AssistantChat({ aiEnabled, compact = false, listenForVoice = false }: { aiEnabled: boolean; compact?: boolean; listenForVoice?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const voice = useVoiceCommand((text) => ask(text));
  const startVoice = voice.start;

  // The sidebar's "Mondd Flaviónak" button.
  useEffect(() => {
    if (!listenForVoice || !aiEnabled) return;
    const go = () => void startVoice();
    window.addEventListener(VOICE_EVENT, go);
    return () => window.removeEventListener(VOICE_EVENT, go);
  }, [listenForVoice, aiEnabled, startVoice]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    const next: Message[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setError(null);
    start(async () => {
      const r = await askAssistantAction(next.map((m) => ({ role: m.role, content: m.content }))).catch(actionFailed);
      if (r.ok) {
        setMessages([...next, { role: "assistant", content: r.answer, sources: r.sources, confirmations: r.confirmations }]);
        if (r.navigate) router.push(r.navigate);
      }
      else {
        setError(r.error);
        setMessages(messages);
        setInput(q);
      }
    });
  }

  return (
    <div className={compact ? "flex min-h-0 flex-1 flex-col" : "mx-auto flex min-h-[70dvh] max-w-3xl flex-col"}>
      {messages.length === 0 ? (
        <div className={cn("flex flex-1 flex-col items-center justify-center text-center", compact && "overflow-y-auto px-5 py-6")}>
          {compact ? (
            <h2 className="text-xl leading-tight">Miben segíthetek?</h2>
          ) : (
            <>
              <Eyebrow>AI-asszisztens</Eyebrow>
              <h1 className="mt-5 text-[34px] leading-tight sm:text-[44px] sm:tracking-[-0.05em]">Kérdezz bármit</h1>
            </>
          )}
          <p className={cn("mt-3 max-w-md text-muted", compact && "text-sm")}>
            Kérdezz az ügyfeleidről és ingatlanaidról, vagy kérd meg, hogy csináljon meg valamit: feladatot, jegyzetet, szerződést, levelet. Szólhatsz is hozzá a mikrofonnal.
          </p>
          {aiEnabled && (
            <div className={cn("grid w-full gap-2", compact ? "mt-6" : "mt-10 sm:grid-cols-2")}>
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className={cn(
                    "rounded-2xl border border-border text-left text-sm text-text transition-colors hover:border-border-strong hover:bg-surface",
                    compact ? "px-4 py-3" : "p-4",
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={cn("flex flex-1 flex-col gap-6 pb-6", compact && "gap-5 overflow-y-auto px-4 pt-3")}>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
            >
              <RotateCcw className="size-3.5" /> Új beszélgetés
            </button>
          </div>
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-[15px] text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3">
                  <Answer content={m.content} sources={m.sources} confirmations={m.confirmations} />
                </div>
              </div>
            ),
          )}
          {pending && (
            <div className="flex items-center gap-3 text-sm text-muted">
              <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent">
                <Loader2 className="size-4 animate-spin" />
              </span>
              Keresem az adataid között…
            </div>
          )}
          <div ref={bottom} />
        </div>
      )}

      <form
        className={compact ? "border-t border-border p-3" : "sticky bottom-4 mt-6"}
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        {(error ?? voice.error) && (
          <p role="alert" className="mb-2 text-center text-sm text-danger">
            {error ?? voice.error}
          </p>
        )}
        {voice.state !== "idle" && (
          <div className="pop-in mb-2 flex items-center justify-center gap-3 rounded-2xl bg-accent-soft/60 px-4 py-2.5 text-sm text-accent">
            {voice.state === "listening" ? (
              <>
                <span className="flex h-5 items-center gap-0.5" aria-hidden>
                  {[0.6, 1, 0.75, 0.9, 0.5].map((k, i) => (
                    <span key={i} className="w-1 rounded-full bg-accent transition-[height] duration-100" style={{ height: `${Math.max(4, voice.level * 20 * k)}px` }} />
                  ))}
                </span>
                Hallgatlak… mondd, mit csináljak
              </>
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" /> Leírom…
              </>
            )}
          </div>
        )}
        <div className={cn("flex items-end gap-2 rounded-3xl border border-border-strong bg-background p-2 pl-5 focus-within:border-ink", !compact && "shadow-float")}>
          <Sparkles className="mb-3 size-4 shrink-0 text-accent" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            disabled={!aiEnabled}
            placeholder={aiEnabled ? (compact ? "Kérdezz bármit…" : "Kérdezz bármit az ügyfeleidről, ingatlanaidról, feladataidról…") : "Az AI most nem érhető el."}
            aria-label="Kérdés az AI-asszisztensnek"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-ink placeholder:text-subtle focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (voice.state === "listening") return voice.stop();
              voice.clearError();
              void voice.start();
            }}
            disabled={!aiEnabled || pending || voice.state === "transcribing"}
            aria-label={voice.state === "listening" ? "Felvétel befejezése" : "Mondd el hangosan"}
            title={voice.state === "listening" ? "Befejezés" : "Mondd el hangosan"}
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full disabled:opacity-40",
              voice.state === "listening" ? "bg-danger text-white" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            {voice.state === "listening" ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
          </button>
          <button
            type="submit"
            disabled={!aiEnabled || pending || !input.trim()}
            aria-label="Küldés"
            className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40")}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        {!compact && (
          <p className="mt-2 text-center text-xs text-muted">
            Feladatot, jegyzetet, ügyfelet és szerződéstervezetet magától létrehoz; a megtekintést és az ügylet léptetését előbb jóváhagyod, levelet pedig sosem küld el magától. A beszélgetést nem mentjük.
          </p>
        )}
      </form>
    </div>
  );
}
