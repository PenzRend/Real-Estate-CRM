import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportWorkspace } from "@/components/listings/import-workspace";
import { Eyebrow } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { llmConfig } from "@/lib/ai/config";
import { getCurrentUser } from "@/lib/auth";
import { listOwnerOptions } from "@/lib/db/properties";

export const metadata: Metadata = { title: "Importálás hirdetésből" };

async function ImportContent() {
  const user = await getCurrentUser();
  const owners = await listOwnerOptions(user);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>Ingatlanok</Eyebrow>}
        title="Importálás hirdetésből"
        description="Illeszd be a hirdetés linkjét és szövegét – vagy használd a böngészőbővítményt –, az AI kitölti az adatlapot, te ellenőrzöd és mented."
      />
      <ImportWorkspace owners={owners} aiEnabled={llmConfig() != null} />
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ImportContent />
    </Suspense>
  );
}
