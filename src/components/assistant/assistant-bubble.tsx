"use client";

import { Maximize2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AssistantChat } from "./assistant-chat";

/**
 * The assistant one tap away on every screen: a round button in the bottom-right
 * corner that opens the chat in a panel. It lives in the layout, so the
 * conversation survives moving between pages.
 */
export function AssistantBubble({ aiEnabled }: { aiEnabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("textarea")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The full-page assistant is already on screen there.
  if (pathname === "/assistant") return null;

  return (
    <>
      {/* Hidden rather than removed when closed, so the conversation is kept. */}
      <section
        ref={panel}
        hidden={!open}
        aria-label="AI-asszisztens"
        // On a phone the panel covers the screen, so following a source link closes it.
        onClick={(e) => {
          if ((e.target as Element).closest("a") && window.matchMedia("(max-width: 639px)").matches) setOpen(false);
        }}
        className="fixed inset-0 z-40 flex flex-col bg-background sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-3xl sm:border sm:border-border sm:shadow-float"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-accent">
            <Sparkles className="size-3.5" />
          </span>
          <p className="flex-1 text-sm font-medium text-ink">AI-asszisztens</p>
          <Link
            href="/assistant"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
            aria-label="Megnyitás teljes oldalon"
            title="Megnyitás teljes oldalon"
          >
            <Maximize2 className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
            aria-label="Bezárás"
          >
            <X className="size-4" />
          </button>
        </header>
        <AssistantChat aiEnabled={aiEnabled} compact />
      </section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "AI-asszisztens bezárása" : "AI-asszisztens"}
        title="AI-asszisztens"
        className={cn(
          "fixed right-5 bottom-5 z-40 grid size-14 place-items-center rounded-full bg-primary text-white shadow-float transition-transform hover:scale-105 hover:bg-primary-hover sm:right-6 sm:bottom-6",
          open && "hidden sm:grid",
        )}
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>
    </>
  );
}
