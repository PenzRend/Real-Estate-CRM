import { Plus } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { ViewTabs, ViewTabsPlaceholder } from "@/components/ui/view-tabs";
import { getCurrentUser } from "@/lib/auth";
import { dealSummary } from "@/lib/deals/data";
import { formatPrice } from "@/lib/i18n/format";

const DEAL_VIEWS = [
  { value: "open", label: "Folyamatban" },
  { value: "won", label: "Sikeres" },
  { value: "lost", label: "Meghiúsult" },
];

const STAT_LABELS = ["Folyamatban lévő ügylet", "Jutalék a folyamatban lévőkben", "Várható jutalék ebben a hónapban", "Sikeres lezárás ebben a hónapban"];

async function Summary() {
  const user = await getCurrentUser();
  const s = await dealSummary(user, new Date());
  return <SummaryPanel values={[String(s.openCount), formatPrice(s.pipelineCommission), formatPrice(s.thisMonthCommission), String(s.wonThisMonth)]} />;
}

/** The totals; with no values (while loading) the same panel with dashes, so nothing below moves. */
function SummaryPanel({ values }: { values?: string[] }) {
  const stats = STAT_LABELS.map((label, i) => ({ label, value: values?.[i] ?? "–" }));
  return (
    <Panel className="grid grid-cols-2 lg:grid-cols-4">
      {stats.map((x, i) => (
        <div key={x.label} className={`min-w-0 p-4 ${i % 2 === 1 ? "border-l border-border" : ""} ${i >= 2 ? "border-t border-border lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
          <div className="truncate text-[17px] font-medium tracking-[-0.02em] text-ink tabular-nums sm:text-[22px]">{x.value}</div>
          <div className="mt-1 text-xs text-muted sm:text-sm">{x.label}</div>
        </div>
      ))}
    </Panel>
  );
}

/** What stays while the deal views switch: the header, the totals and the tabs. Only the board (page.tsx) loads. */
export default function DealsLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition>
      <div data-wide className="flex flex-col gap-6">
        <PageHeader
          title="Ügyletek"
          description="Ajánlattól a jutalékig: foglaló, adásvételi, finanszírozás, birtokbaadás – határidőkkel."
          actions={
            <ButtonLink href="/deals/new">
              <Plus /> Új ügylet
            </ButtonLink>
          }
        />
        <Suspense fallback={<SummaryPanel />}>
          <Summary />
        </Suspense>
        <Suspense fallback={<ViewTabsPlaceholder label="Nézetek" items={DEAL_VIEWS} />}>
          <ViewTabs label="Nézetek" items={DEAL_VIEWS} />
        </Suspense>
        {children}
      </div>
    </PageTransition>
  );
}
