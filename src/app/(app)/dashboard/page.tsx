import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardView } from "@/components/crm/dashboard-view";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Áttekintés" };

// Lists are filled in once the client/property/task queries land; until then
// every section shows its empty state and counts are unknown ("—").
async function DashboardContent() {
  await connection();
  const user = isSupabaseConfigured ? await getCurrentUser() : null;

  return (
    <DashboardView
      now={new Date()}
      data={{
        userFirstName: user?.firstName ?? null,
        tasksToday: [],
        overdue: [],
        activity: [],
        recentProperties: [],
        recentClients: [],
        suggestions: [],
        counts: null,
      }}
    />
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
