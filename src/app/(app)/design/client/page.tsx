import { connection } from "next/server";
import { ClientDetailView } from "@/components/crm/client-detail-view";
import { SampleDataBanner } from "../sample-banner";
import { sampleClient } from "../sample-data";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

async function DesignClientContent() {
  await connection();
  return (
    <>
      <SampleDataBanner />
      <ClientDetailView client={sampleClient} />
    </>
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function DesignClientPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DesignClientContent />
    </Suspense>
  );
}
