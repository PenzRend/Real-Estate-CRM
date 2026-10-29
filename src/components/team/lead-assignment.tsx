"use client";

import { Shuffle, UserCheck } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setInRotationAction, setLeadModeAction } from "@/app/(app)/office/actions";
import { cn } from "@/lib/cn";

/**
 * Who gets a new client: the agent who added it, or in turn among the agents
 * ticked here (portal inquiries and new contacts are shared out evenly). The
 * agent who gets one is notified.
 */
export function LeadAssignment({ mode, members }: { mode: "creator" | "round_robin"; members: { userId: string; name: string; inRotation: boolean }[] }) {
  const [shown, setShown] = useOptimistic(mode);
  const [ticked, setTicked] = useOptimistic(new Set(members.filter((m) => m.inRotation).map((m) => m.userId)), (set: Set<string>, change: { id: string; on: boolean }) => {
    const next = new Set(set);
    if (change.on) next.add(change.id);
    else next.delete(change.id);
    return next;
  });
  const [, start] = useTransition();
  const options = [
    { value: "creator" as const, label: "Aki felveszi", hint: "Az új ügyfél azé, aki rögzíti (vagy akinek a levelezéséből jön).", icon: UserCheck },
    { value: "round_robin" as const, label: "Sorban kiosztva", hint: "Az új ügyfelek felváltva jutnak a kijelölt munkatársakhoz.", icon: Shuffle },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:col-span-2">
      <p className="text-sm font-medium text-ink">Új ügyfelek kiosztása</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={shown === o.value}
            onClick={() =>
              start(async () => {
                setShown(o.value);
                await setLeadModeAction(o.value);
              })
            }
            className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition-colors", shown === o.value ? "border-primary bg-surface" : "border-border hover:border-border-strong")}
          >
            <o.icon className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>
              <span className="block text-sm font-medium text-ink">{o.label}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {shown === "round_robin" && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {members.map((m) => (
            <label key={m.userId} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ticked.has(m.userId)}
                onChange={(e) => {
                  const on = e.target.checked;
                  start(async () => {
                    setTicked({ id: m.userId, on });
                    await setInRotationAction(m.userId, on);
                  });
                }}
                className="size-4 accent-[var(--primary)]"
              />
              {m.name}
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-subtle">Aki új ügyfelet kap mástól, értesítést kap róla (ha bekapcsolta az értesítéseket).</p>
    </div>
  );
}
