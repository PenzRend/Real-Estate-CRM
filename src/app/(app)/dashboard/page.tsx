import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardView } from "@/components/crm/dashboard-view";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Áttekintés" };

async function DashboardContent() {
  await connection();
  const now = new Date();
  if (!isSupabaseConfigured) {
    // Without a database every section shows its empty state and counts are unknown.
    return (
      <DashboardView
        now={now}
        data={{ userFirstName: null, tasksToday: [], overdue: [], activity: [], recentProperties: [], recentClients: [], suggestions: [], counts: null }}
      />
    );
  }
  const user = await getCurrentUser();
  return <DashboardView now={now} data={await getDashboardData(user, now)} />;
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
