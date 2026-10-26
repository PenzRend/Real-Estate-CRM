import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { ClientFilterBar, ClientsTable, type ClientFilters } from "@/components/crm/clients-list";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Ügyfelek" };

async function ClientsContent({ searchParams }: Pick<PageProps<"/clients">, "searchParams">) {
  const params = await searchParams;
  const filters: ClientFilters = {
    q: typeof params.q === "string" ? params.q : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    type: typeof params.type === "string" ? params.type : undefined,
  };
  const filtered = Boolean(filters.q || filters.status || filters.type);

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
      <ClientFilterBar filters={filters} />
      <ClientsTable clients={[]} filtered={filtered} now={new Date()} />
    </div>
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientsContent searchParams={searchParams} />
    </Suspense>
  );
}
