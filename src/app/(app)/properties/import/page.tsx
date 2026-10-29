import type { Metadata } from "next";
import { ImportWorkspace } from "@/components/listings/import-workspace";
import { Eyebrow } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { llmConfig, transcriptionConfig } from "@/lib/ai/config";
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
        description="Add meg a hirdetés linkjét: az AI kitölti az adatlapot, a fotókat és a videólinkeket is átveszi – te ellenőrzöd és mented."
      />
      <ImportWorkspace
        owners={owners}
        aiEnabled={llmConfig() != null}
        canDictate={transcriptionConfig() != null}
        installLinks={{ chrome: process.env.EXTENSION_CHROME_URL || null, safari: process.env.EXTENSION_SAFARI_URL || null }}
      />
    </div>
  );
}

export default function ImportPage() {
  return (
    <PageSuspense>
      <ImportContent />
    </PageSuspense>
  );
}
