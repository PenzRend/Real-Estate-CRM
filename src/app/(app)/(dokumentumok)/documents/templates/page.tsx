import { FilePlus2, FileText, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { StarterTemplatesButton } from "@/components/office-docs/starter-templates-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { listFolders } from "@/lib/office-docs/data";
import { listTemplates, triggerLabels } from "@/lib/office-docs/templates";

export const metadata: Metadata = { title: "Dokumentumkészítő" };

async function Templates() {
  await connection();
  const user = await getCurrentUser();
  const [templates, folders] = await Promise.all([listTemplates(user), listFolders(user)]);
  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dokumentumkészítő"
        description="Saját sablonok (levél, ajánlat, tájékoztató), amelyeket Flavio kitölt az ügyfél, ingatlan vagy ügylet adataival."
        actions={
          <ButtonLink href="/documents/templates/new">
            <FilePlus2 /> Új sablon
          </ButtonLink>
        }
      />
      {templates.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/documents/templates/${t.id}`} className="flex h-full flex-col gap-3 rounded-3xl border border-border bg-background p-5 transition-colors hover:border-border-strong">
                <span className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <FileText className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{t.name}</span>
                    <span className="block text-xs text-muted">Mappa: {t.folderId ? (folderName.get(t.folderId) ?? "Egyéb") : "Egyéb"}</span>
                  </span>
                </span>
                <span className="line-clamp-3 font-mono text-xs text-muted">{t.body.slice(0, 220) || "Üres sablon"}</span>
                <span className="mt-auto flex flex-wrap gap-2">
                  {t.trigger !== "manual" ? (
                    <Badge tone={t.active ? "accent" : "neutral"}>
                      <Zap className="size-3" /> {triggerLabels[t.trigger]}
                    </Badge>
                  ) : (
                    <Badge>{triggerLabels.manual}</Badge>
                  )}
                  {!t.active && <Badge tone="warning">Kikapcsolva</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-strong px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <FileText className="size-6" />
          </span>
          <p className="font-medium text-ink">Még nincs sablon</p>
          <p className="max-w-md text-sm text-muted">Kezdd egy példával (bemutatkozó levél, foglalási megállapodás, ingatlan-bemutató), vagy írj sajátot.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <StarterTemplatesButton />
            <ButtonLink href="/documents/templates/new" variant="secondary">
              <FilePlus2 /> Új sablon
            </ButtonLink>
          </div>
        </div>
      )}
      {templates.length > 0 && (
        <div>
          <StarterTemplatesButton variant="ghost" />
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <PageSuspense>
      <Templates />
    </PageSuspense>
  );
}
