import { Archive, ArchiveRestore } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientDetailView } from "@/components/crm/client-detail-view";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getClientDetail } from "@/lib/db/clients";
import { matchesForClient } from "@/lib/db/matches";
import { listOwnedProperties } from "@/lib/db/properties";
import { PropertyMatchesCard } from "@/components/crm/match-lists";
import { archiveClientAction, restoreClientAction } from "../actions";

export const metadata: Metadata = { title: "Ügyfél" };

async function ClientContent({ params, searchParams }: PageProps<"/clients/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const [detail, owned, matches] = await Promise.all([
    getClientDetail(user, id),
    listOwnedProperties(user, id),
    matchesForClient(user, id),
  ]);
  if (!detail) notFound();
  // Owned listings first, then properties linked through interest/viewings.
  const linkedIds = new Set(detail.relatedProperties.map((p) => p.id));
  const client = {
    ...detail,
    relatedProperties: [
      ...owned.filter((p) => !linkedIds.has(p.id)).map((p) => ({ ...p, relation: "owner" })),
      ...detail.relatedProperties,
    ],
  };

  const actions = client.archivedAt ? (
    <form action={restoreClientAction.bind(null, client.id)}>
      <Button type="submit" variant="secondary">
        <ArchiveRestore /> Visszaállítás
      </Button>
    </form>
  ) : (
    <ConfirmAction
      action={archiveClientAction.bind(null, client.id)}
      trigger={
        <>
          <Archive /> Archiválás
        </>
      }
      title={`${client.fullName} archiválása`}
      description="Az ügyfél kikerül a listákból és az utánkövetésekből, de minden adata megmarad. Bármikor visszaállíthatod."
      confirmLabel="Archiválás"
    />
  );

  const notice = query.saved === "1" ? "Elmentve. Az ügyfél adatai, a beszélgetés és a teendők frissültek." : null;
  const hasRequirements = Boolean(
    client.budgetMin != null || client.budgetMax != null || client.preferredLocations.length || client.requirements.propertyTypes.length,
  );
  const wantsListings = ["buyer", "investor", "tenant"].includes(client.clientType);
  return (
    <ClientDetailView
      client={client}
      actions={actions}
      archivedAt={client.archivedAt}
      notice={notice}
      matches={wantsListings && !client.archivedAt ? <PropertyMatchesCard clientId={client.id} matches={matches} hasRequirements={hasRequirements} /> : null}
    />
  );
}

export default function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
