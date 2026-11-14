import { Plus, Search, SquareKanban } from "lucide-react";
import type { Metadata } from "next";
import { ClientBoard } from "@/components/crm/client-board";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListSuspense } from "@/components/ui/list-suspense";
import { EmptyState } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth";
import { listClients } from "@/lib/db/clients";
import { parseHungarianNumber } from "@/lib/validation/client";

export const metadata: Metadata = { title: "Értékesítési tölcsér" };

/** Every column at once, so more cards than the list shows rows. */
const BOARD_LIMIT = 400;
const FOLLOW_UPS = ["overdue", "today", "week", "none"] as const;

async function Board({ searchParams }: Pick<PageProps<"/clients/pipeline">, "searchParams">) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string).slice(0, 100) : undefined);
  const budget = parseHungarianNumber(one("budget") ?? "");
  const user = await getCurrentUser();
  const now = new Date();
  const filters = {
    q: one("q"),
    type: one("type"),
    followUp: FOLLOW_UPS.find((v) => v === one("followUp")),
    budgetM: typeof budget === "number" && !Number.isNaN(budget) ? budget : undefined,
    location: one("location"),
    assignedTo: one("mine") === "1" ? user.id : undefined,
  };
  const filtered = Object.values(filters).some((v) => v !== undefined);
  const { clients, total } = await listClients(user, { ...filters, limit: BOARD_LIMIT }, now);

  if (!clients.length) {
    return (
      <Card>
        {filtered ? (
          <EmptyState icon={Search} title="Nincs találat" description="Próbálj más keresőszót vagy kevesebb szűrőt." />
        ) : (
          <EmptyState
            icon={SquareKanban}
            title="Még üres a tölcsér"
            description="Minden új ügyfél az „Új érdeklődő” oszlopban indul, és innen viszed tovább a lezárásig."
            action={
              <ButtonLink href="/clients/new">
                <Plus /> Új ügyfél
              </ButtonLink>
            }
          />
        )}
      </Card>
    );
  }
  return <ClientBoard clients={clients} total={total} limit={BOARD_LIMIT} now={now.toISOString()} />;
}

export default function PipelinePage({ searchParams }: PageProps<"/clients/pipeline">) {
  return (
    <ListSuspense>
      <Board searchParams={searchParams} />
    </ListSuspense>
  );
}
