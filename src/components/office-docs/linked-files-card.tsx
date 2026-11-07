import { Download, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth";
import type { RefKind } from "@/lib/chat/refs";
import { formatDate } from "@/lib/i18n/format";
import { filesFor } from "@/lib/office-docs/links";
import { GenerateFromTemplate } from "./generate-from-template";

const empty: Record<RefKind, string> = {
  client: "Még nincs ehhez az ügyfélhez kapcsolt fájl. A Dokumentumok között bármelyik fájlt hozzákapcsolhatod, vagy készíts egyet sablonból.",
  property: "Még nincs ehhez az ingatlanhoz kapcsolt fájl a Dokumentumok közül.",
  deal: "Még nincs ehhez az ügylethez kapcsolt fájl. Készíts egyet sablonból, pl. foglalási megállapodást.",
};

/** Files from Dokumentumok linked to this client, listing or deal, and "Sablonból" to write a new one. */
export async function LinkedFilesCard({ user, kind, id }: { user: CurrentUser; kind: RefKind; id: string }) {
  const files = await filesFor(user, kind, id);
  return (
    <Card>
      <CardHeader title="Kapcsolódó fájlok" count={files.length} action={<GenerateFromTemplate kind={kind} id={id} />} />
      {files.length ? (
        <ul className="divide-y divide-border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/documents?doc=${f.id}`} className="block truncate text-sm font-medium text-ink hover:text-accent">
                  {f.title}
                </Link>
                <p className="flex items-center gap-1 text-xs text-muted">
                  {formatDate(f.createdAt)}
                  {f.source === "template" && (
                    <>
                      {" "}
                      · <Sparkles className="size-3" /> sablonból
                    </>
                  )}
                  {f.source === "ai" && " · AI kapcsolta"}
                </p>
              </div>
              {f.url && (
                <a href={f.url} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`${f.title} letöltése`}>
                  <Download className="size-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">{empty[kind]}</p>
      )}
    </Card>
  );
}
