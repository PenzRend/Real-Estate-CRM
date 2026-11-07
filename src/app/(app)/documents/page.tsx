import type { Metadata } from "next";
import { connection } from "next/server";
import { DocumentLibrary } from "@/components/office-docs/document-library";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { listFolders, listOfficeDocuments } from "@/lib/office-docs/data";

export const metadata: Metadata = { title: "Dokumentumok" };

async function Documents() {
  await connection();
  const user = await getCurrentUser();
  const [documents, folders] = await Promise.all([listOfficeDocuments(user), listFolders(user)]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dokumentumok" description="Az iroda közös fájljai: szerződésminták, sablonok, árlisták, marketinganyagok – egy helyen, mindenkinek." />
      <DocumentLibrary organizationId={user.organization.id} documents={documents} folders={folders} />
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <PageSuspense>
      <Documents />
    </PageSuspense>
  );
}
