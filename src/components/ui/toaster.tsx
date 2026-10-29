"use client";

import { Check, Loader2, Undo2, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

// Short notes at the bottom of the screen: "Archiválva · Visszavonás". Used
// instead of "Are you sure?" dialogs for everyday actions that can be undone.

type Toast = { id: number; message: string; undo?: () => Promise<unknown>; undoneMessage?: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<Toast, "id">) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { ...t, id }];
  emit();
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function ToastItem({ t }: { t: Toast }) {
  const [state, setState] = useState<"idle" | "undoing" | "undone">("idle");
  // A note stays for 8 seconds, long enough to undo.
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), state === "undone" ? 2500 : 8000);
    return () => clearTimeout(timer);
  }, [t.id, state]);

  return (
    <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-float [animation:vt-rise-in_200ms_ease-out_both]">
      {state === "undone" ? <Undo2 className="size-4 shrink-0" /> : <Check className="size-4 shrink-0 text-success" />}
      <span className="min-w-0 flex-1">{state === "undone" ? (t.undoneMessage ?? "Visszavonva.") : t.message}</span>
      {t.undo && state !== "undone" && (
        <button
          type="button"
          disabled={state === "undoing"}
          onClick={async () => {
            setState("undoing");
            await t.undo!().catch(() => undefined);
            setState("undone");
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-medium text-white underline-offset-2 hover:bg-white/10"
        >
          {state === "undoing" ? <Loader2 className="size-3.5 animate-spin" /> : null} Visszavonás
        </button>
      )}
      <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 text-white/60 hover:text-white" aria-label="Bezárás">
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-8">
      {list.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
