import { Plus } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { ClientFiltersFromUrl } from "@/components/crm/filter-bars";
import { ButtonLink } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";

/** What stays while Ügyfelek is searched and filtered: the header and the filters. Only the list (page.tsx) loads. */
export default function ClientsLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader
        title="Ügyfelek"
        description="Vevők, eladók, tulajdonosok és befektetők egy helyen."
        actions={
          <ButtonLink href="/clients/new">
            <Plus /> Új ügyfél
          </ButtonLink>
        }
      />
      <Suspense fallback={<div className="h-11 shimmer rounded-xl bg-surface" />}>
        <ClientFiltersFromUrl />
      </Suspense>
      {children}
    </PageTransition>
  );
}
