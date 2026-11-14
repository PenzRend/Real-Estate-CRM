import { Plus } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { ClientFiltersFromUrl, ClientFiltersPlaceholder } from "@/components/crm/filter-bars";
import { ButtonLink } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { SectionBar } from "@/components/ui/section-switch";

/** Értékesítési tölcsér: the header and the filters stay while the board below reloads. */
export default function PipelineLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionBar group="ugyfelek" />
      <PageTransition className="flex flex-col gap-6">
        <PageHeader
          title="Értékesítési tölcsér"
          description="Hol tart minden ügyfeled. Húzd a kártyát a következő szakaszba, amikor továbblép."
          actions={
            <ButtonLink href="/clients/new">
              <Plus /> Új ügyfél
            </ButtonLink>
          }
        />
        <Suspense fallback={<ClientFiltersPlaceholder action="/clients/pipeline" />}>
          <ClientFiltersFromUrl action="/clients/pipeline" />
        </Suspense>
        {children}
      </PageTransition>
    </>
  );
}
