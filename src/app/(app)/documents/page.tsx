import type { Metadata } from "next";
import { DOCUMENT_SECTIONS, SectionSwitch } from "@/components/ui/section-switch";
import { connection } from "next/server";
import { DocumentLibrary } from "@/components/office-docs/document-library";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { listFolders, listOfficeDocuments } from "@/lib/office-docs/data";

export const metadata: Metadata = { title: "Dokumentumok" };

async function Documents({ searchParams }: Pick<PageProps<"/documents">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const user = await getCurrentUser();
  const [documents, folders] = await Promise.all([listOfficeDocuments(user), listFolders(user)]);
  return (
    <div className="flex flex-col gap-6">
      <SectionSwitch items={DOCUMENT_SECTIONS} />
      <PageHeader title="Dokumentumok" description="Az iroda közös fájljai, ügyfelekhez, ingatlanokhoz és ügyletekhez kapcsolva." />
      <DocumentLibrary
        organizationId={user.organization.id}
        documents={documents}
        folders={folders}
        initialFolder={typeof params.folder === "string" ? params.folder : (documents.find((d) => d.id === params.doc)?.folderId ?? "all")}
        highlight={typeof params.doc === "string" ? params.doc : null}
      />
    </div>
  );
}

export default function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  return (
    <PageSuspense>
      <Documents searchParams={searchParams} />
    </PageSuspense>
  );
}
