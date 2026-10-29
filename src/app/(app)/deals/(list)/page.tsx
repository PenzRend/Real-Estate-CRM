import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { DealCard } from "@/components/deals/deal-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListSuspense } from "@/components/ui/list-suspense";
import { EmptyState } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth";
import { listDeals, type DealView } from "@/lib/deals/data";
import { DEAL_STAGES, stageHints, stageLabels } from "@/lib/deals/logic";
import { formatPrice } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Ügyletek" };

async function Deals({ searchParams }: Pick<PageProps<"/deals">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const view: DealView = params.view === "won" || params.view === "lost" ? params.view : "open";
  const user = await getCurrentUser();
  const deals = await listDeals(user, view);
  const today = new Date().toISOString().slice(0, 10);

  if (view !== "open") {
    return deals.length ? (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} today={today} showStage />
        ))}
      </div>
    ) : (
      <Card>
        <EmptyState icon={Handshake} title={view === "won" ? "Még nincs lezárt ügylet." : "Nincs meghiúsult ügylet."} />
      </Card>
    );
  }

  if (!deals.length) {
    return (
      <Card>
        <EmptyState
          icon={Handshake}
          title="Még nincs folyamatban lévő ügylet."
          description="Amikor egy vevő ajánlatot tesz, indíts ügyletet: a foglaló, az adásvételi és a birtokbaadás határidői maguktól feladattá válnak."
          action={<ButtonLink href="/deals/new">Új ügylet</ButtonLink>}
        />
      </Card>
    );
  }

  // The board: one column per stage (the last one, "Jutalék", holds deals waiting for the commission).
  const open = DEAL_STAGES.filter((s) => s !== "closed");
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
      <ol className="grid min-w-[60rem] grid-cols-5 gap-3">
        {open.map((stage) => {
          const inStage = deals.filter((d) => d.stage === stage);
          const total = inStage.reduce((s, d) => s + (d.commissionValue ?? 0), 0);
          return (
            <li key={stage} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface/60 p-2">
              <div className="px-1.5 pt-1">
                <p className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
                  {stageLabels[stage]} <span className="text-xs font-normal text-muted tabular-nums">{inStage.length}</span>
                </p>
                <p className="text-[11px] leading-snug text-subtle">{stageHints[stage]}</p>
                {total > 0 && <p className="mt-1 text-[11px] text-success tabular-nums">{formatPrice(total)} jutalék</p>}
              </div>
              {inStage.map((d) => (
                <DealCard key={d.id} deal={d} today={today} />
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function DealsPage({ searchParams }: PageProps<"/deals">) {
  return (
    <ListSuspense>
      <Deals searchParams={searchParams} />
    </ListSuspense>
  );
}
