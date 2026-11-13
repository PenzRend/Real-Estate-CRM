"use client";

import { Check, CircleAlert, Copy, Globe } from "lucide-react";
import { useState, useTransition } from "react";
import { renewListingFeedAction, saveJofogasAction } from "@/app/(app)/settings/feed-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";

const when = new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Budapest" });

/**
 * The portal export link: the listings marked "Portálokra", as an XML feed a
 * portal imports. Owners and admins create it; a new link replaces the old.
 */
export function ListingFeed({
  active,
  listings,
  lastFetchedAt,
  canManage,
  jofogas,
}: {
  active: boolean;
  listings: number;
  lastFetchedAt: string | null;
  canManage: boolean;
  jofogas: { partnerId: string | null; phone: string | null };
}) {
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
            Ezt a linket add meg a portál partnerkapcsolatán: a portál rendszeresen letölti, és a jelölt aktív hirdetéseket a fotókkal együtt frissíti. Az utca és házszám nem kerül bele. A portálok saját szerződést kérnek az automatikus feltöltéshez.
          </p>
          <p className="text-xs font-medium text-ink">Jófogás link (a Jófogás saját formátumában):</p>
          <Input value={jofogasUrl(url)} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Jófogás export link" className="bg-background text-xs" />
          <p className="text-xs text-muted">Most másold ki mindkettőt: biztonsági okból később nem látszanak, csak új linket lehet kérni.</p>
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
      {(active || url) && canManage && <JofogasSetup initial={jofogas} />}
    </div>
  );
}

/** The Jófogás link is the same feed, in Jófogás's own format. */
const jofogasUrl = (url: string) => url.replace(/\.xml$/, "/jofogas.xml");

/** What Jófogás needs besides the link: a mobile number on every ad, and the partner ID it assigns. */
function JofogasSetup({ initial }: { initial: { partnerId: string | null; phone: string | null } }) {
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [partnerId, setPartnerId] = useState(initial.partnerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveJofogasAction({ phone, partnerId }).catch(actionFailed);
      if (r.ok) {
        setError(null);
        toast({ message: "Jófogás-beállítás mentve." });
      } else setError(r.error);
    });

  return (
    <details className="group rounded-xl bg-surface p-3" open={!initial.phone}>
      <summary className="cursor-pointer list-none text-sm font-medium text-ink">
        Jófogás {initial.phone && initial.partnerId ? <span className="font-normal text-success">· beállítva</span> : <span className="font-normal text-muted">· beállítás</span>}
      </summary>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>Add meg a mobilszámot, amely minden Jófogás-hirdetésen szerepel.</li>
        <li>Írj az ingatlan@jofogas.hu címre, és küldd el a Jófogás linket (új link létrehozásakor látod). Ők küldenek egy partnerazonosítót.</li>
        <li>Írd be ide a partnerazonosítót. A Jófogás naponta letölti a hirdetéseket; az első letöltés után aktiváló levelet küldenek.</li>
      </ol>
      <p className="mt-2 text-xs text-muted">Csak a forintos árú, irányítószámmal megadott, „Portálokra” jelölt aktív hirdetések kerülnek fel; a fotókat a Jófogás csak szerződéses partnereknek veszi át.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Mobilszám a hirdetésekhez" htmlFor="jfg-phone">
          <Input id="jfg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+36 30 123 4567" className="bg-background" />
        </Field>
        <Field label="Jófogás partnerazonosító" htmlFor="jfg-partner">
          <Input id="jfg-partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="A Jófogás küldi" className="bg-background" />
        </Field>
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}
      <Button size="sm" className="mt-3" onClick={save} disabled={saving}>
        {saving ? "Mentés…" : "Mentés"}
      </Button>
    </details>
  );
}
