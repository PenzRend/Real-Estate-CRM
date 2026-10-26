"use client";

import { Check, CircleHelp, Minus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createMatchTaskAction, dismissMatchAction } from "@/app/(app)/matches/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { categoryLabels, type Check as MatchCheck, type CheckStatus, type MatchCategory } from "@/lib/matching/match";

const categoryTone = { strong: "success", good: "accent", possible: "neutral" } as const;

export function MatchCategoryBadge({ category }: { category: MatchCategory }) {
  return <Badge tone={categoryTone[category]}>{categoryLabels[category]}</Badge>;
}

const statusStyle: Record<CheckStatus, { icon: typeof Check; className: string; sr: string }> = {
  met: { icon: Check, className: "bg-success-soft text-success", sr: "teljesül" },
  close: { icon: Minus, className: "bg-warning-soft text-warning", sr: "majdnem" },
  miss: { icon: X, className: "bg-danger-soft text-danger", sr: "nem teljesül" },
  unknown: { icon: CircleHelp, className: "bg-surface-strong text-muted", sr: "nincs adat" },
};

/** One chip per requirement; the full sentence is in the tooltip and for screen readers. */
export function MatchChecks({ checks }: { checks: MatchCheck[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Egyezés részletei">
      {checks.map((c) => {
        const s = statusStyle[c.status];
        const Icon = s.icon;
        return (
          <li key={c.key} title={`${c.label}: ${c.detail}`} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs", s.className)}>
            <Icon className="size-3" strokeWidth={2.5} aria-hidden />
            {c.label}
            <span className="sr-only">
              {" "}
              ({s.sr}: {c.detail})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Ajánlom" creates a task and stops suggesting the pair; "Nem releváns" hides it. */
export function MatchActions({
  propertyId,
  clientId,
  decided,
}: {
  propertyId: string;
  clientId: string;
  decided?: "task_created" | null;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<"task_created" | "dismissed" | null>(decided ?? null);

  if (done === "task_created") return <span className="text-xs font-medium text-success">✓ Feladat létrehozva</span>;
  if (done === "dismissed") return <span className="text-xs text-muted">Elrejtve</span>;

  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await createMatchTaskAction(propertyId, clientId);
            setDone("task_created");
          })
        }
        className="rounded-full bg-primary px-3 py-1 text-xs font-medium whitespace-nowrap text-white hover:bg-primary-hover disabled:opacity-50"
      >
        Ajánlom
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await dismissMatchAction(propertyId, clientId);
            setDone("dismissed");
          })
        }
        className="rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap text-muted hover:bg-surface hover:text-ink disabled:opacity-50"
      >
        Nem releváns
      </button>
    </div>
  );
}
