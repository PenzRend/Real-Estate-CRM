import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl border border-border bg-background", className)}>{children}</section>;
}

export function CardHeader({
  title,
  count,
  action,
}: {
  title: string;
  /** Rendered as a muted "/ 03" counter next to the title. */
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
      <h2 className="flex items-baseline gap-2 text-base tracking-tight">
        {title}
        {count != null && (
          <span className="text-sm font-normal tracking-normal text-subtle tabular-nums">
            / {String(count).padStart(2, "0")}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

/** Soft gray panel, used for grouped stats and secondary content. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl bg-surface", className)}>{children}</div>;
}

/** Row of large numbers separated by hairlines, as on the reference site. */
export function StatRow({ stats }: { stats: Array<{ label: string; value: ReactNode; hint?: string }> }) {
  return (
    <Panel className="grid grid-cols-2 lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "flex flex-col justify-between gap-6 p-5",
            i % 2 === 1 && "border-l border-border",
            i >= 2 && "border-t border-border lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <div className="text-[32px] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums">{s.value}</div>
          <div>
            <div className="text-sm text-text">{s.label}</div>
            {s.hint && <div className="text-xs text-muted">{s.hint}</div>}
          </div>
        </div>
      ))}
    </Panel>
  );
}
