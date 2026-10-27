"use client";

import { ArrowUp, Building2, CheckSquare, Compass, Loader2, Mail, MessageSquareText, RotateCcw, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistantAction } from "@/app/(app)/assistant/actions";
import { Eyebrow } from "@/components/ui/badge";
import { parseAnswer, type Inline } from "@/lib/assistant/format";
import type { Source, SourceType } from "@/lib/assistant/tools";
import { cn } from "@/lib/cn";
import { actionFailed } from "@/lib/action-failed";

type Message = { role: "user"; content: string } | { role: "assistant"; content: string; sources: Source[] };

const EXAMPLES = [
  "Kiket kell ma utánkövetnem?",
  "Mely feladataim jártak le?",
  "Mely aktív ingatlanok illenek a vevőimhez?",
  "Hol tudok megtekintést foglalni?",
];

const icons: Record<SourceType, typeof UserRound> = {
  client: UserRound,
  property: Building2,
  task: CheckSquare,
  interaction: MessageSquareText,
  email: Mail,
  page: Compass,
};

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

function Answer({ content, sources }: { content: string; sources: Source[] }) {
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
export function AssistantChat({ aiEnabled, compact = false }: { aiEnabled: boolean; compact?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

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
      if (r.ok) setMessages([...next, { role: "assistant", content: r.answer, sources: r.sources }]);
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
            Az ügyfeleidről, ingatlanaidról és feladataidról, vagy arról, hol mit találsz a Flavióban. Minden állítás mellé odateszi a forrást.
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
                  <Answer content={m.content} sources={m.sources} />
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
        {error && <p role="alert" className="mb-2 text-center text-sm text-danger">{error}</p>}
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
            Csak olvas: nem küld levelet és nem módosít adatot. A beszélgetést nem mentjük.
          </p>
        )}
      </form>
    </div>
  );
}
