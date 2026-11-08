import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContractReview } from "@/components/contracts/contract-review";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { getDraft } from "@/lib/contracts/data";
import { DOCUMENTS_BUCKET } from "@/lib/documents/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Szerződés" };

async function Review({ params }: Pick<PageProps<"/contracts/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const user = await getCurrentUser();
  const draft = await getDraft(user, id);
  if (!draft) notFound();
  let documentUrl: string | null = null;
  if (draft.documentId) {
    const supabase = await createClient();
    const { data: doc } = await supabase.from("office_documents").select("storage_path").eq("id", draft.documentId).maybeSingle();
    if (doc) documentUrl = (await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 3600, { download: true })).data?.signedUrl ?? null;
  }
  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader eyebrow={<span className="text-xs text-muted">{draft.label}</span>} title={draft.title} description="Ellenőrizd az adatokat, egészítsd ki, ami hiányzik, olvasd át a szöveget – a jóváhagyás után Word-fájl lesz belőle." />
      <ContractReview draft={draft} documentUrl={documentUrl} />
    </div>
  );
}

export default function ContractPage({ params }: PageProps<"/contracts/[id]">) {
  return (
    <PageSuspense>
      <Review params={params} />
    </PageSuspense>
  );
}
