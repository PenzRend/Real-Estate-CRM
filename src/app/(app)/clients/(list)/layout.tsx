import { FileSpreadsheet, Plus } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { ClientFiltersFromUrl, ClientFiltersPlaceholder } from "@/components/crm/filter-bars";
import { ButtonLink } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { ViewTabs, ViewTabsPlaceholder } from "@/components/ui/view-tabs";

const VIEWS = [
  { value: "list", label: "Lista" },
  { value: "board", label: "Tábla" },
];
const KEEP = ["q", "status", "type", "followUp", "budget", "location", "archived", "mine"];

/** What stays while Ügyfelek is searched and filtered: the header and the filters. Only the list (page.tsx) loads. */
export default function ClientsLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader
        title="Ügyfelek"
        description="Vevők, eladók, tulajdonosok és befektetők egy helyen."
        actions={
          <>
            <ButtonLink href="/clients/import" variant="secondary">
              <FileSpreadsheet /> Importálás
            </ButtonLink>
            <ButtonLink href="/clients/new">
              <Plus /> Új ügyfél
            </ButtonLink>
          </>
        }
      />
      <Suspense fallback={<ViewTabsPlaceholder label="Nézet" items={VIEWS} />}>
        <ViewTabs label="Nézet" items={VIEWS} keep={KEEP} />
      </Suspense>
      <Suspense fallback={<ClientFiltersPlaceholder />}>
        <ClientFiltersFromUrl />
      </Suspense>
      {children}
    </PageTransition>
  );
}
