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
import { listOwnedProperties } from "@/lib/db/properties";
import { archiveClientAction, restoreClientAction } from "../actions";

export const metadata: Metadata = { title: "Ügyfél" };

async function ClientContent({ params }: Pick<PageProps<"/clients/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [detail, owned] = await Promise.all([getClientDetail(user, id), listOwnedProperties(user, id)]);
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

  return <ClientDetailView client={client} actions={actions} archivedAt={client.archivedAt} />;
}

export default function ClientPage({ params }: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientContent params={params} />
    </Suspense>
  );
}
