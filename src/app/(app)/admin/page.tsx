import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SignupCodes } from "@/components/admin/admin-panels";
import { PaymentsList, PlanEditor, WorkspaceAccessList } from "@/components/admin/billing-admin";
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
  listPayments,
  listSignupCodes,
  listUsers,
  listWorkspaceBilling,
  listWorkspaceUsage,
  serviceKeyStatus,
} from "@/lib/admin";
import { defaultDailyLimit, defaultMonthlyLimit } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/billing/data";

export const metadata: Metadata = { title: "Pilot admin" };

const TABS = [
  { value: "attekintes", label: "Áttekintés" },
  { value: "felhasznalok", label: "Felhasználók" },
  { value: "munkateruletek", label: "Munkaterületek" },
  { value: "elofizetesek", label: "Előfizetések" },
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
    case "elofizetesek": {
      const [plan, rows, payments, workspaces] = await Promise.all([getPlan(), listWorkspaceBilling(), listPayments(), listWorkspaceUsage()]);
      const owners = Object.fromEntries(workspaces.map((w) => [w.id, w.ownerEmail]));
      return (
        <div className="flex flex-col gap-6">
          <Card title="Csomag" description="Ingatlanosonként (a munkaterület minden tagja egy hely). Az árak végösszegek (alanyi adómentes). A pilot és a próbaidő a szerver alap AI-kereteit kapja.">
            {plan ? (
              <PlanEditor
                plan={{
                  id: plan.id,
                  name: plan.name,
                  priceMonth: plan.priceMonth,
                  priceYear: plan.priceYear,
                  aiDailyPerSeat: plan.aiDailyPerSeat,
                  aiMonthlyPerSeat: plan.aiMonthlyPerSeat,
                  hasStripePrices: !!plan.stripePriceMonthId && !!plan.stripePriceYearId,
                }}
              />
            ) : (
              <p className="text-sm text-muted">Nincs csomag (a számlázási adatbázis-frissítés még hiányzik?).</p>
            )}
          </Card>
          <Card title="Fizetések" description="Minden Stripe-fizetéshez neked kell számlát kiállítanod (Billingo). A vevő adatai itt vannak; a számla sorszámát beírva jelölöd késznek.">
            <PaymentsList payments={payments} />
          </Card>
          <Card title="Munkaterületek hozzáférése" description="Pilot: ingyenes, amíg át nem állítod. Próbaidő: ingyenes a megadott napig. Ingyenes vége: csak előfizetéssel használható tovább.">
            <WorkspaceAccessList rows={rows} owners={owners} />
          </Card>
        </div>
      );
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
