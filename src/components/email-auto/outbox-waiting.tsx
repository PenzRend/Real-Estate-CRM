import { MailCheck } from "lucide-react";
import Link from "next/link";

/** On the dashboard: automatic emails waiting for the agent's OK. */
export function OutboxWaiting({ count }: { count: number }) {
  return (
    <Link href="/inbox/automation" className="flex items-center gap-3 rounded-3xl border border-warning/30 bg-background px-5 py-4 hover:bg-surface">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
        <MailCheck className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{count} automatikus levél vár jóváhagyásra</span>
        <span className="block text-xs text-muted">Nézd át, írj bele, ha kell, és küldd el.</span>
      </span>
      <span className="text-xs text-muted">Megnyitás →</span>
    </Link>
  );
}
