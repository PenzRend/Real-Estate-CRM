import { connection } from "next/server";
import { ClientFilterBar, ClientsTable } from "@/components/crm/clients-list";
import { PageHeader } from "@/components/ui/page";
import { SampleDataBanner } from "../sample-banner";
import { sampleDashboard } from "../sample-data";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

async function DesignClientsContent() {
  await connection();
  return (
    <>
      <SampleDataBanner />
      <div className="flex flex-col gap-6">
        <PageHeader title="Ügyfelek" description="Vevők, eladók, tulajdonosok és befektetők egy helyen." />
        <ClientFilterBar filters={{}} />
        <ClientsTable clients={sampleDashboard.recentClients} filtered={false} now={new Date()} />
      </div>
    </>
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function DesignClientsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DesignClientsContent />
    </Suspense>
  );
}
