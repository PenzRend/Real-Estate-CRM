"use client";

import { Check, CircleAlert, Copy, Globe } from "lucide-react";
import { useState, useTransition } from "react";
import { renewListingFeedAction } from "@/app/(app)/settings/feed-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";

const when = new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Budapest" });

/**
 * The portal export link: the listings marked "Portálokra", as an XML feed a
 * portal imports. Owners and admins create it; a new link replaces the old.
 */
export function ListingFeed({ active, listings, lastFetchedAt, canManage }: { active: boolean; listings: number; lastFetchedAt: string | null; canManage: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await renewListingFeedAction().catch(actionFailed);
      if (r.ok) {
        setUrl(r.url);
        setError(null);
        setCopied(false);
      } else setError(r.error);
    });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:col-span-2">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted">
          <Globe className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Hirdetési portálok (XML export)</p>
          <p className="mt-0.5 text-sm text-muted">
            {listings ? `${listings} hirdetés jelölve „Portálokra”.` : "Még nincs „Portálokra” jelölt hirdetés – az ingatlan oldalán jelölheted."}
            {active && (lastFetchedAt ? ` Utoljára letöltve: ${when.format(new Date(lastFetchedAt))}.` : " A linket még nem töltötte le portál.")}
          </p>
        </div>
      </div>

      {url ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-3" role="status">
          <Input value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Portál export link" className="bg-background text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(url).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Kimásolva" : "Link másolása"}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Ezt a linket add meg a portál partnerkapcsolatán (pl. ingatlan.com, Otthon Centrum partner, Jófogás): a portál rendszeresen letölti, és a jelölt aktív hirdetéseket a fotókkal együtt frissíti. Az utca és házszám nem kerül bele. A portálok saját szerződést kérnek az automatikus feltöltéshez.
          </p>
        </div>
      ) : !canManage ? (
        <p className="text-xs text-muted">A linket a munkaterület tulajdonosa vagy egy admin hozhatja létre.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant={active ? "secondary" : "primary"} onClick={create} disabled={busy}>
            {busy ? "Létrehozás…" : active ? "Új link létrehozása" : "Export link létrehozása"}
          </Button>
          {active && <p className="text-xs text-muted">Már van aktív link. Új link esetén a régi megszűnik, és a portálnál is cserélni kell.</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
