"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { updateDealFieldAction } from "@/app/(app)/deals/actions";
import { Input, Select, Textarea } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";

type Kind = "date" | "money" | "percent" | "notes" | "select";

/**
 * One deal field that saves itself: dates and choices on change, sums and
 * notes when the field is left. A small tick (or the error) shows it went
 * through; there is no Save button to forget.
 */
export function DealField({
  dealId,
  field,
  label,
  kind,
  value,
  options,
  placeholder,
  hint,
}: {
  dealId: string;
  field: string;
  label: string;
  kind: Kind;
  value: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
}) {
  const saved = useRef(value);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `deal-${field}`;

  function save(next: string) {
    if (next === saved.current) return;
    start(async () => {
      const r = await updateDealFieldAction(dealId, field, next).catch(actionFailed);
      if ("ok" in r && r.ok) {
        saved.current = next;
        setState("saved");
        setError(null);
      } else {
        setState("error");
        setError(("error" in r && r.error) || "A mentés nem sikerült.");
      }
    });
  }

  const status = pending ? (
    <Loader2 className="size-3.5 animate-spin text-muted" aria-label="Mentés…" />
  ) : state === "saved" ? (
    <Check className="size-3.5 text-success" aria-label="Mentve" />
  ) : state === "error" ? (
    <CircleAlert className="size-3.5 text-danger" aria-hidden />
  ) : null;

  const common = { id, "aria-invalid": state === "error", className: cn(kind !== "notes" && "h-10") };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
        {label} {status}
      </label>
      {kind === "date" ? (
        <Input {...common} type="date" defaultValue={value} onChange={(e) => save(e.target.value)} />
      ) : kind === "select" ? (
        <Select {...common} defaultValue={value} onChange={(e) => save(e.target.value)}>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : kind === "notes" ? (
        <Textarea {...common} defaultValue={value} placeholder={placeholder} onBlur={(e) => save(e.target.value)} className="min-h-24" />
      ) : (
        <Input
          {...common}
          inputMode="decimal"
          defaultValue={value}
          placeholder={placeholder}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      )}
      {error ? <p className="text-xs text-danger">{error}</p> : hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}
