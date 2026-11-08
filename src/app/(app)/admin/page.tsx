import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SignupCodes } from "@/components/admin/admin-panels";
import { AiTab, Card, FeedbackTab, OverviewTab, SystemTab } from "@/components/admin/dashboard";
import { UsersTable, WorkspacesTable } from "@/components/admin/tables";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { ViewTabs, ViewTabsPlaceholder } from "@/components/ui/view-tabs";
import {
  configStatus,
  getAiBreakdown,
  getDaily,
  getOverview,
  getSystemStatus,
  isPlatformAdmin,
  listFeedback,
  listSignupCodes,
  listUsers,
  listWorkspaceUsage,
  serviceKeyStatus,
} from "@/lib/admin";
import { defaultDailyLimit, defaultMonthlyLimit } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Pilot admin" };

const TABS = [
  { value: "attekintes", label: "Áttekintés" },
  { value: "felhasznalok", label: "Felhasználók" },
  { value: "munkateruletek", label: "Munkaterületek" },
  { value: "ai", label: "AI" },
  { value: "rendszer", label: "Rendszer" },
  { value: "visszajelzesek", label: "Visszajelzések" },
  { value: "kodok", label: "Meghívókódok" },
];

/** One tab's content; each loads only what it shows. */
async function Tab({ tab }: { tab: string }) {
  const defaultLimit = defaultMonthlyLimit();
  const defaultDaily = defaultDailyLimit();
  switch (tab) {
    case "felhasznalok":
      return <UsersTable users={await listUsers()} />;
    case "munkateruletek":
      return <WorkspacesTable workspaces={await listWorkspaceUsage()} defaultLimit={defaultLimit} defaultDaily={defaultDaily} />;
    case "ai": {
      const [rows, workspaces] = await Promise.all([getAiBreakdown(), listWorkspaceUsage()]);
      return <AiTab rows={rows} config={configStatus()} workspaces={workspaces} defaultLimit={defaultLimit} defaultDaily={defaultDaily} />;
    }
    case "rendszer":
      return <SystemTab system={await getSystemStatus()} config={configStatus()} />;
    case "visszajelzesek":
      return <FeedbackTab items={await listFeedback()} />;
    case "kodok":
      return (
        <Card
          title="Meghívókódok"
          description="Új fiókot csak kóddal lehet nyitni. Minden kód egyszer használható, 60 napig érvényes. Akit egy csapatba hívnak meg, annak nem kell kód."
        >
          <SignupCodes codes={await listSignupCodes()} />
        </Card>
      );
    default: {
      const [overview, daily, system, workspaces] = await Promise.all([getOverview(), getDaily(30), getSystemStatus(), listWorkspaceUsage()]);
      if (!overview) return <p className="text-sm text-muted">Az adatok nem érhetők el.</p>;
      return <OverviewTab overview={overview} daily={daily} system={system} config={configStatus()} workspaces={workspaces} defaultLimit={defaultLimit} defaultDaily={defaultDaily} />;
    }
  }
}

async function AdminContent({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const user = await getCurrentUser();
  // Not a page for anyone else: it does not exist for them.
  if (!isPlatformAdmin(user)) notFound();
  const params = await searchParams;
  const tab = typeof params.tab === "string" && TABS.some((t) => t.value === params.tab) ? params.tab : TABS[0].value;
  const key = await serviceKeyStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pilot admin" description="A pilot egésze: felhasználók, munkaterületek, AI-használat, rendszerállapot és meghívókódok." />
      {key !== "ok" && (
        <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          {key === "missing"
            ? "A szerveren nincs beállítva a SUPABASE_SECRET_KEY, ezért az adatok nem látszanak."
            : "A Supabase nem fogadja el a SUPABASE_SECRET_KEY-t (hibás vagy törölt kulcs). Az adatok nem látszanak, és a háttérfolyamatok (automatikus levelek, emlékeztetők, értesítések) sem futnak. Hozz létre új secret kulcsot a Supabase-ben, és írd be a Vercelben, majd telepítsd újra."}
        </p>
      )}
      <Suspense fallback={<ViewTabsPlaceholder label="Admin nézetek" items={TABS} />}>
        <ViewTabs param="tab" label="Admin nézetek" items={TABS} />
      </Suspense>
      <Suspense key={tab} fallback={<p className="text-sm text-muted">Betöltés…</p>}>
        <Tab tab={tab} />
      </Suspense>
    </div>
  );
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <PageSuspense>
      <AdminContent searchParams={searchParams} />
    </PageSuspense>
  );
}
