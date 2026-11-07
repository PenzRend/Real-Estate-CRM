import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { TemplateEditor } from "@/components/office-docs/template-editor";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { listFolders } from "@/lib/office-docs/data";
import { getTemplate } from "@/lib/office-docs/templates";

export const metadata: Metadata = { title: "Sablon" };

/** "/documents/templates/new" writes a new template; an id opens one. */
async function Editor({ params }: Pick<PageProps<"/documents/templates/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const user = await getCurrentUser();
  const [template, folders] = await Promise.all([id === "new" ? null : getTemplate(user, id), listFolders(user)]);
  if (id !== "new" && !template) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={template ? template.name : "Új sablon"} description="Írd meg egyszer, és Flavio minden ügyfélnél, ingatlannál vagy ügyletnél kitölti – a jobb oldalon látod, hogyan fog kinézni." />
      <TemplateEditor template={template} folders={folders} />
    </div>
  );
}

export default function TemplatePage({ params }: PageProps<"/documents/templates/[id]">) {
  return (
    <PageSuspense>
      <Editor params={params} />
    </PageSuspense>
  );
}
