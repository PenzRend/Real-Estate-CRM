"use client";

import { Check, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { setTargetAction } from "@/app/(app)/office/actions";
import { actionFailed } from "@/lib/action-failed";

/** An agent's target for the month, typed in place and saved when the field is left. */
export function TargetField({ userId, month, field, value, label }: { userId: string; month: string; field: string; value: number | null; label: string }) {
  const saved = useRef(value == null ? "" : String(value));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const save = (next: string) => {
    if (next.trim() === saved.current) return;
    start(async () => {
      const r = await setTargetAction(userId, month, field, next).catch(actionFailed);
      if (r.ok) {
        saved.current = next.trim();
        setState("saved");
      } else setState("error");
    });
  };
  return (
    <span className="relative inline-flex items-center">
      <input
        defaultValue={value == null ? "" : String(value)}
        inputMode="decimal"
        placeholder="cél"
        aria-label={label}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={`h-7 w-20 rounded-lg border bg-background px-2 text-right text-xs tabular-nums focus:border-ink focus:outline-none ${state === "error" ? "border-danger" : "border-border"}`}
      />
      <span className="absolute -right-4">{pending ? <Loader2 className="size-3 animate-spin text-muted" /> : state === "saved" ? <Check className="size-3 text-success" /> : null}</span>
    </span>
  );
}
