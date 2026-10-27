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
