import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureWorkspace } from "@/components/capture/capture-workspace";
import { Eyebrow } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { llmConfig, transcriptionConfig } from "@/lib/ai/config";
import { getCurrentUser } from "@/lib/auth";
import { listClientOptions, listPropertyOptions } from "@/lib/db/activity";
import { interactionTypeLabels } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: "Rögzítés" };

async function CaptureContent({ searchParams }: Pick<PageProps<"/interactions/new">, "searchParams">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const [clients, properties] = await Promise.all([listClientOptions(user), listPropertyOptions(user)]);
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const clientId = clients.some((c) => c.id === one("client")) ? one("client") : undefined;
  const propertyId = properties.some((p) => p.id === one("property")) ? one("property") : undefined;
  const type = one("type") && one("type")! in interactionTypeLabels ? one("type") : undefined;
  const client = clients.find((c) => c.id === clientId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>Rögzítés</Eyebrow>}
        title={client ? `Beszélgetés: ${client.name}` : "Mi történt?"}
        description="Írd le vagy mondd el pár mondatban. Az AI kitölti az ügyfél adatait, a határidőket és a teendőket, te csak jóváhagyod."
      />
      <CaptureWorkspace
        clients={clients}
        properties={properties}
        defaults={{ clientId, propertyId, type }}
        aiEnabled={llmConfig() != null}
        transcriptionEnabled={transcriptionConfig() != null}
      />
    </div>
  );
}

export default function CapturePage({ searchParams }: PageProps<"/interactions/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CaptureContent searchParams={searchParams} />
    </Suspense>
  );
}
