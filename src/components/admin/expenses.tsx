"use client";

import { Loader2, Plus, Repeat, Square, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { addExpenseAction, deleteExpenseAction, stopExpenseAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from "@/lib/finance";
import { formatDate, formatPrice } from "@/lib/i18n/format";
import { parseHungarianNumber } from "@/lib/validation/client";

/** One line to add a cost: date, category, what for, amount, and whether it repeats monthly. */
export function ExpenseForm({ today }: { today: string }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  return (
    <form
      key={key}
      action={(form) =>
        start(async () => {
          setError(null);
          const amount = parseHungarianNumber(String(form.get("amount") ?? ""));
          if (typeof amount !== "number" || Number.isNaN(amount)) {
            setError("Adj meg egy összeget forintban.");
            return;
          }
          const r = await addExpenseAction({
            spentOn: String(form.get("spentOn") ?? ""),
            category: String(form.get("category") ?? "other") as ExpenseCategory,
            description: String(form.get("description") ?? ""),
            amount,
            monthly: form.get("monthly") === "on",
          });
          if (!r.ok) return setError(r.error);
          setKey((k) => k + 1);
          toast({ message: "Kiadás rögzítve." });
        })
      }
      className="flex flex-col gap-2"
    >
      <div className="grid gap-2 sm:grid-cols-[9.5rem_12rem_1fr_9rem]">
        <Input name="spentOn" type="date" required defaultValue={today} aria-label="Dátum" />
        <Select name="category" defaultValue="hosting" aria-label="Kategória">
          {Object.entries(EXPENSE_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input name="description" required maxLength={200} placeholder="Mire ment, pl. Vercel Pro" aria-label="Leírás" />
        <Input name="amount" required inputMode="decimal" placeholder="Összeg (Ft)" aria-label="Összeg forintban" className="tabular-nums" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="monthly" className="size-4 accent-[var(--primary)]" /> Havonta ismétlődik
        </label>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />} Kiadás rögzítése
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** The costs entered: the monthly ones still running first, then the rest by date. */
export function ExpenseList({ expenses, today }: { expenses: Expense[]; today: string }) {
  const [busy, start] = useTransition();
  const running = (e: Expense) => e.monthly && (!e.endsOn || e.endsOn >= today);
  const sorted = [...expenses].sort((a, b) => Number(running(b)) - Number(running(a)) || b.spentOn.localeCompare(a.spentOn));
  if (!sorted.length) return <p className="text-sm text-muted">Még nincs rögzített kiadás.</p>;

  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      toast({ message: r.ok ? done : r.error });
    });

  return (
    <ul className="-mx-5 divide-y divide-border border-t border-border text-sm">
      {sorted.slice(0, 100).map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5">
          <span className="w-24 shrink-0 text-xs text-muted tabular-nums">{formatDate(e.spentOn)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ink">{e.description}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              {EXPENSE_CATEGORIES[e.category]}
              {e.monthly && (
                <>
                  {" · "}
                  <Repeat className="size-3" /> {running(e) ? "havonta" : `havonta, ${formatDate(e.endsOn)}-ig`}
                </>
              )}
            </span>
          </span>
          <span className="font-medium text-ink tabular-nums">
            {formatPrice(e.amount)}
            {e.monthly && <span className="font-normal text-muted"> / hó</span>}
          </span>
          <span className="flex gap-1">
            {running(e) && (
              <Button variant="ghost" size="xs" disabled={busy} onClick={() => act(() => stopExpenseAction(e.id), "Leállítva: ettől a hónaptól nem számít.")} title="Ebben a hónapban még számít, utána nem">
                <Square /> Leállítás
              </Button>
            )}
            <Button
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Törlöd ezt a kiadást? (${e.description}, ${formatPrice(e.amount)})`)) act(() => deleteExpenseAction(e.id), "Kiadás törölve.");
              }}
              aria-label={`${e.description} törlése`}
            >
              <Trash2 />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}
