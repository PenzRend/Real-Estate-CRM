import { CheckCircle2, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientFilterBar, ClientsTable, type ClientFilters } from "@/components/crm/clients-list";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { countArchivedClients, LIST_LIMIT, listClients, type ClientListFilters } from "@/lib/db/clients";
import { parseHungarianNumber } from "@/lib/validation/client";

export const metadata: Metadata = { title: "Ügyfelek" };

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
  const { clients, total } = await listClients(user, toQuery(filters), now);
  const filtered = Object.values(filters).some(Boolean);
  const archivedCount = total === 0 && !filtered ? await countArchivedClients(user) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ügyfelek"
        description="Vevők, eladók, tulajdonosok és befektetők egy helyen."
        actions={
          <ButtonLink href="/clients/new">
            <Plus /> Új ügyfél
          </ButtonLink>
        }
      />
      {params.erased === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Az ügyfél és minden adata véglegesen törölve.
        </p>
      )}
      <ClientFilterBar filters={filters} />
      {total > 0 && (
        <p className="-mb-3 text-sm text-muted" aria-live="polite">
          {total > LIST_LIMIT ? `${total} ügyfélből az első ${LIST_LIMIT} látható. Szűkítsd a keresést.` : `${total} ügyfél`}
        </p>
      )}
      <ClientsTable clients={clients} filtered={filtered} now={now} archivedCount={archivedCount} />
    </div>
  );
}

export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientsContent searchParams={searchParams} />
    </Suspense>
  );
}
