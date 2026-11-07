import { FileSignature } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth";
import { listDrafts } from "@/lib/contracts/data";
import { CONTRACT_KINDS, kindsFor } from "@/lib/contracts/kinds";
import { formatDate } from "@/lib/i18n/format";
import { NewContractMenu } from "./new-contract-menu";

/** The contracts of a deal, listing or client, and "Új szerződés" with the kinds that fit. */
export async function ContractsCard({ user, from, id, rent = false, clientId = null }: { user: CurrentUser; from: "deal" | "property" | "client"; id: string; rent?: boolean; clientId?: string | null }) {
  const drafts = await listDrafts(user, from === "deal" ? { dealId: id } : from === "property" ? { propertyId: id } : { clientId: id });
  const kinds = kindsFor(from, { rent });
  return (
    <Card>
      <CardHeader
        title="Szerződések"
        count={drafts.length}
        action={
          <NewContractMenu
            kinds={kinds.map((k) => ({ kind: k, label: CONTRACT_KINDS[k].label, short: CONTRACT_KINDS[k].short }))}
            refs={from === "deal" ? { dealId: id } : from === "property" ? { propertyId: id, clientId } : { clientId: id }}
            from={from}
          />
        }
      />
      {drafts.length ? (
        <ul className="divide-y divide-border">
          {drafts.map((d) => (
            <li key={d.id}>
              <Link href={`/contracts/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
                <FileSignature className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{d.label}</span>
                  <span className="block text-xs text-muted">{formatDate(d.createdAt)}</span>
                </span>
                {d.status === "approved" ? <Badge tone="success">Jóváhagyva</Badge> : <Badge tone="warning">Átnézendő</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">Még nincs szerződés. Az „Új” gombbal Flavio megírja a tervezetet az adatokból.</p>
      )}
    </Card>
  );
}
