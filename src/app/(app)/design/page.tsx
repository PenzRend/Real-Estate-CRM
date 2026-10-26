import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardView } from "@/components/crm/dashboard-view";
import { SampleDataBanner } from "./sample-banner";
import { sampleDashboard } from "./sample-data";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Dizájn-előnézet" };

async function DesignDashboardContent() {
  await connection();
  return (
    <>
      <SampleDataBanner />
      <DashboardView data={sampleDashboard} now={new Date()} />
    </>
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function DesignDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DesignDashboardContent />
    </Suspense>
  );
}
