import { Download, FileSpreadsheet, Plus } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { PropertyFiltersFromUrl, PropertyFiltersPlaceholder } from "@/components/crm/filter-bars";
import { ButtonLink } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";

/** What stays while Ingatlanok is searched and filtered: the header and the filters. Only the list (page.tsx) loads. */
export default function PropertiesLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader
        title="Ingatlanok"
        description="Eladó és kiadó ingatlanaid, fotókkal és illő ügyfelekkel."
        actions={
          <>
            <ButtonLink href="/properties/import/table" variant="secondary">
              <FileSpreadsheet /> Táblázatból
            </ButtonLink>
            <ButtonLink href="/properties/import" variant="secondary">
              <Download /> Importálás hirdetésből
            </ButtonLink>
            <ButtonLink href="/properties/new">
              <Plus /> Új ingatlan
            </ButtonLink>
          </>
        }
      />
      <Suspense fallback={<PropertyFiltersPlaceholder />}>
        <PropertyFiltersFromUrl />
      </Suspense>
      {children}
    </PageTransition>
  );
}
