import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContractTemplateEditor } from "@/components/contracts/contract-template-editor";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { CONTRACT_KINDS, FIELD_CATALOG, isContractKind } from "@/lib/contracts/kinds";
import { officeTemplate } from "@/lib/contracts/templates";

export const metadata: Metadata = { title: "Szerződés szövege" };

const MONEY_KEYS = ["iranyar", "vetelar", "foglalo", "berleti_dij", "kaucio"];

async function Editor({ params }: Pick<PageProps<"/contracts/templates/[kind]">, "params">) {
  await connection();
  const { kind } = await params;
  if (!isContractKind(kind)) notFound();
  const user = await getCurrentUser();
  const office = await officeTemplate(user, kind);
  const def = CONTRACT_KINDS[kind];
  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<span className="text-xs text-muted">Szerződés szövege</span>}
        title={def.label}
        description={`${def.short} Ezzel a szöveggel készül minden új tervezet – a mezők az ügyletből, az ingatlanból és az ügyfelekből töltődnek ki.`}
      />
      <ContractTemplateEditor
        kind={kind}
        label={def.label}
        defaultBody={def.body}
        office={office}
        fields={def.fields}
        knownKeys={FIELD_CATALOG.map((f) => f.key)}
        moneyKeys={MONEY_KEYS}
        canEdit={user.organization.role !== "member"}
      />
    </div>
  );
}

export default function ContractTemplatePage({ params }: PageProps<"/contracts/templates/[kind]">) {
  return (
    <PageSuspense>
      <Editor params={params} />
    </PageSuspense>
  );
}
