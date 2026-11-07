import { FileSignature } from "lucide-react";
import Link from "next/link";
import { ArrowLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { DraftListItem } from "@/lib/contracts/data";

/** On the dashboard: contract drafts waiting for the agent's review. */
export function ContractsWaiting({ drafts }: { drafts: DraftListItem[] }) {
  return (
    <Card className="border-warning/30">
      <CardHeader title="Átnézendő szerződések" count={drafts.length} action={<ArrowLink href="/contracts">Összes</ArrowLink>} />
      <ul className="divide-y divide-border">
        {drafts.slice(0, 4).map((d) => (
          <li key={d.id}>
            <Link href={`/contracts/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
              <FileSignature className="size-4 shrink-0 text-warning" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{d.title}</span>
                <span className="block text-xs text-muted">{d.origin === "auto" ? "Magától készült – nézd át" : "Tervezet"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
