import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardView } from "@/components/crm/dashboard-view";
import { AwayPanel } from "@/components/dashboard/away-panel";
import { llmConfig } from "@/lib/ai/config";
import { getCurrentUser } from "@/lib/auth";
import { getAwaySummary } from "@/lib/away/data";
import { getDashboardData } from "@/lib/db/dashboard";
import { ViewingsCard } from "@/components/viewings/viewings-card";
import { listOpenViewings } from "@/lib/viewings/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Áttekintés" };

// Result of the "Küldés engedélyezése" Google consent round trip.
async function notice(searchParams: PageProps<"/dashboard">["searchParams"]) {
  const p = await searchParams;
  if (p.send_enabled === "1") return "send_enabled";
  return typeof p.mail_error === "string" ? p.mail_error : null;
}

async function DashboardContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
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
  const [data, away, shown, viewings] = await Promise.all([getDashboardData(user, now), getAwaySummary(user, now), notice(searchParams), listOpenViewings(user, now)]);
  return (
    <DashboardView
      now={now}
      data={data}
      away={<AwayPanel summary={away} aiEnabled={llmConfig() != null} notice={shown} />}
      viewings={<ViewingsCard viewings={viewings} now={now.toISOString()} empty="Nincs foglalt megtekintés a következő két hétben. Egy ügyfél levelénél vagy az ingatlan oldalán foglalhatsz." />}
    />
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
