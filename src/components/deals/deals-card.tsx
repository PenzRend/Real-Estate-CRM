import { Handshake, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { Deal } from "@/lib/deals/data";
import { DealCard } from "./deal-card";

/** The deals of a listing or a client, with a one-click start that fills in what is known. */
export function DealsCard({ deals, newHref, empty }: { deals: Deal[]; newHref: string; empty: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card>
      <CardHeader
        title="Ügyletek"
        count={deals.length}
        action={
          <ButtonLink href={newHref} variant="secondary" size="sm">
            <Plus /> Ügylet indítása
          </ButtonLink>
        }
      />
      {deals.length ? (
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} today={today} showStage />
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted">
          <Handshake className="size-4 shrink-0" /> {empty}
        </p>
      )}
    </Card>
  );
}
