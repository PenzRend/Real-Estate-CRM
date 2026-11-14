import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { ClientBoard } from "@/components/crm/client-board";
import { ClientsTable, type ClientFilters } from "@/components/crm/clients-list";
import { ListSuspense } from "@/components/ui/list-suspense";
import { getCurrentUser } from "@/lib/auth";
import { countArchivedClients, LIST_LIMIT, listClients, type ClientListFilters } from "@/lib/db/clients";
import { parseHungarianNumber } from "@/lib/validation/client";

export const metadata: Metadata = { title: "Ügyfelek" };

/** The board shows more cards than the list shows rows: every column at once. */
const BOARD_LIMIT = 400;

const FOLLOW_UPS = ["overdue", "today", "week", "none"] as const;

function readFilters(params: Record<string, string | string[] | undefined>): ClientFilters {
  const one = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string).slice(0, 100) : undefined);
  return {
    q: one("q"),
    status: one("status"),
    type: one("type"),
    followUp: one("followUp"),
    budget: one("budget"),
    location: one("location"),
    archived: one("archived"),
    mine: one("mine"),
  };
}

/** Turns raw URL values into a safe query; unknown values are ignored. */
function toQuery(f: ClientFilters): ClientListFilters {
  const budget = parseHungarianNumber(f.budget ?? "");
  return {
    q: f.q,
    status: f.status,
    type: f.type,
    followUp: FOLLOW_UPS.find((v) => v === f.followUp),
    budgetM: typeof budget === "number" && !Number.isNaN(budget) ? budget : undefined,
    location: f.location,
    archived: f.archived === "1",
  };
}

async function ClientsContent({ searchParams }: Pick<PageProps<"/clients">, "searchParams">) {
  const params = await searchParams;
  const filters = readFilters(params);
  const user = await getCurrentUser();
  const now = new Date();
  const board = params.view === "board";
  const { clients, total } = await listClients(
    user,
    { ...toQuery(filters), assignedTo: filters.mine === "1" ? user.id : undefined, limit: board ? BOARD_LIMIT : undefined },
    now,
  );
  const filtered = Object.values(filters).some(Boolean);
  const archivedCount = total === 0 && !filtered ? await countArchivedClients(user) : 0;

  return (
    <div className="flex flex-col gap-4">
      {params.erased === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Az ügyfél és minden adata véglegesen törölve.
        </p>
      )}
      {total > 0 && (
        <p className="text-sm text-muted" aria-live="polite">
          {total > (board ? BOARD_LIMIT : LIST_LIMIT)
            ? `${total} ügyfélből a legutóbb módosított ${board ? BOARD_LIMIT : LIST_LIMIT} látható. Szűkítsd a keresést.`
            : `${total} ügyfél`}
          {board && total > 0 && <span className="max-sm:hidden"> · Húzd a kártyát egy másik oszlopba a státusz módosításához.</span>}
        </p>
      )}
      {board && clients.length > 0 ? (
        <ClientBoard clients={clients} now={now.toISOString()} />
      ) : (
        <ClientsTable clients={clients} filtered={filtered} now={now} archivedCount={archivedCount} />
      )}
    </div>
  );
}

export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <ListSuspense>
      <ClientsContent searchParams={searchParams} />
    </ListSuspense>
  );
}
