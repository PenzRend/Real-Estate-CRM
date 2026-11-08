import type { Metadata } from "next";
import { ContractsWaiting } from "@/components/contracts/contracts-waiting";
import { listDrafts } from "@/lib/contracts/data";
import { waitingCount } from "@/lib/email-auto/outbox";
import { OutboxWaiting } from "@/components/email-auto/outbox-waiting";
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
import { PageSuspense } from "@/components/ui/page-suspense";
import { DealsPulse } from "@/components/deals/deals-pulse";
import { dealSummary } from "@/lib/deals/data";
import { MyMonth } from "@/components/team/my-month";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { officeStats } from "@/lib/team/office-data";
import { TodayStrip } from "@/components/dashboard/today-strip";
import { WeekCard } from "@/components/team/week-card";
import { weekSummary } from "@/lib/team/week-summary";
import { awaitingFeedback } from "@/lib/viewings/logic";
import { FirstSteps } from "@/components/dashboard/first-steps";
import { TodayRoute } from "@/components/dashboard/today-route";
import { firstSteps } from "@/lib/onboarding/first-steps";

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
    // Without a database every section shows its empty state.
    return (
      <DashboardView
        now={now}
        data={{ userFirstName: null, tasksToday: [], overdue: [], activity: [], recentProperties: [], recentClients: [], suggestions: [] }}
      />
    );
  }
  const user = await getCurrentUser();
  // "Hogy sikerült?" from the phone notification opens that viewing's feedback.
  const feedbackFor = await searchParams.then((p) => (typeof p.feedback === "string" ? p.feedback : null));
  const [data, away, shown, viewings, deals, steps] = await Promise.all([
    getDashboardData(user, now),
    getAwaySummary(user, now),
    notice(searchParams),
    listOpenViewings(user, now),
    dealSummary(user, now),
    firstSteps(user).catch(() => []),
  ]);
  // The agent's own month (numbers and targets).
  const month = await officeStats(user, utcToZonedLocal(now.toISOString()).slice(0, 7)).catch(() => null);
  const me = month?.agents.find((a) => a.userId === user.id) ?? null;
  const [drafts, emailsWaiting] = await Promise.all([listDrafts(user, { status: "draft" }).catch(() => []), waitingCount(user).catch(() => 0)]);
  // Owners and admins see last week's numbers from Monday to Wednesday.
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Budapest" }).format(now);
  const week = user.organization.role !== "member" && ["Mon", "Tue", "Wed"].includes(weekday) ? await weekSummary(user, now).catch(() => null) : null;
  // Emails still to answer: not replied, and not ones the AI found need no answer.
  const mailsWaiting = away.mailbox
    ? away.items.filter((i) => !i.repliedAt && !(i.draft && !i.draft.body)).length + away.olderNewCount
    : null;
  const upcoming = viewings.filter((v) => new Date(v.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <DashboardView
      now={now}
      data={data}
      welcome={<FirstSteps steps={steps} />}
      route={<TodayRoute viewings={viewings.filter((v) => v.agentId === user.id)} now={now} agent={user.fullName} />}
      strip={
        <TodayStrip
          c={{
            overdue: data.overdue.length,
            dueToday: data.tasksToday.length,
            viewings: viewings.length,
            viewingsWaiting: viewings.filter((v) => awaitingFeedback(v, now)).length,
            nextViewing: upcoming[0]?.startsAt ?? null,
            mailsWaiting,
            openDeals: deals.openCount,
            pipeline: deals.pipelineCommission,
          }}
        />
      }
      away={<AwayPanel summary={away} aiEnabled={llmConfig() != null} notice={shown} />}
      deals={
        <>
          {drafts.length > 0 && <ContractsWaiting drafts={drafts} />}
          {emailsWaiting > 0 && <OutboxWaiting count={emailsWaiting} />}
          {week && <WeekCard summary={week} />}
          {me && <MyMonth me={me} />}
          {(deals.openCount > 0 || deals.upcoming.length > 0) && <DealsPulse summary={deals} today={now.toISOString().slice(0, 10)} />}
        </>
      }
      viewings={viewings.length > 0 && <ViewingsCard viewings={viewings} now={now.toISOString()} empty="" openFeedbackFor={feedbackFor} />}
    />
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <PageSuspense>
      <DashboardContent searchParams={searchParams} />
    </PageSuspense>
  );
}
