"use client";

import { ArrowUpRight, CheckCircle2, CircleAlert, ClipboardPaste, ExternalLink, Link2, Loader2, Puzzle, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPropertyAction } from "@/app/(app)/properties/actions";
import { checkImportedAction, extractListingAction } from "@/app/(app)/properties/import/actions";
import { PropertyForm, type OwnerOption } from "@/components/crm/property-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { ImportedRef } from "@/lib/listings/import";
import { decodePayload, type ProfilePayload } from "@/lib/listings/payload";
import { savePending, type PendingSelection } from "@/lib/listings/pending-media";
import { blocksServers, canonicalListingUrl, portalOf } from "@/lib/listings/source";
import { ImportPhotos } from "./import-photos";

type Review = { url: string; values: Record<string, string>; missing: string[]; images: string[]; videos: string[]; source: PendingSelection["source"] };
type Duplicate = ImportedRef & { url: string };
type ExtractInput = { url: string; text?: string; structured?: string | null; images?: string[]; videos?: string[] };

/** Opening a listing with this fragment lets the extension send it straight back here. */
const EXTENSION_HANDOFF = "#crm-import";

/** The extension's bridge script marks CRM pages it runs on. */
const hasExtension = () => typeof document !== "undefined" && document.documentElement.dataset.crmExtension === "1";

function ProfileList({ profile, onBack }: { profile: ProfilePayload; onBack: () => void }) {
  const [imported, setImported] = useState<Record<string, ImportedRef>>({});
  const urls = profile.listings.map((l) => canonicalListingUrl(l.url)).filter(Boolean) as string[];

  useEffect(() => {
    const check = () => void checkImportedAction(urls).then(setImported);
    check();
    // Coming back from an imported listing's tab updates the list.
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const done = urls.filter((u) => imported[u]).length;
  return (
    <Card>
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg">Hirdetések a profiloldalon</h2>
        <p className="text-xs text-muted">
          {profile.listings.length} hirdetés · {done} már bent van a CRM-ben
        </p>
      </div>
      <p className="px-5 pt-4 text-sm text-muted">
        Az „Importálás” megnyitja a hirdetést egy új lapon, a bővítmény onnan visszaküldi ide ellenőrzésre – a fotókkal együtt. Csak a saját vagy az
        irodád hirdetéseit importáld.
      </p>
      <ul className="mt-2 divide-y divide-border">
        {profile.listings.map((l) => {
          const url = canonicalListingUrl(l.url);
          const existing = url ? imported[url] : undefined;
          return (
            <li key={l.url} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{l.title ?? url ?? l.url}</p>
                {l.detail && <p className="truncate text-xs text-muted">{l.detail}</p>}
              </div>
              {existing ? (
                <Link href={`/properties/${existing.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2 className="size-3.5" /> Már bent van{existing.archived ? " (archiválva)" : ""}
                </Link>
              ) : url ? (
                <a
                  href={`${url}${EXTENSION_HANDOFF}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                >
                  Importálás <ArrowUpRight className="size-3.5" />
                </a>
              ) : (
                <span className="text-xs text-subtle">Nem hirdetési link</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border px-5 py-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted hover:text-ink">
          ← Egy hirdetés importálása linkkel
        </button>
      </div>
    </Card>
  );
}

export function ImportWorkspace({ owners, aiEnabled }: { owners: OwnerOption[]; aiEnabled: boolean }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [extension, setExtension] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [fromExtension, setFromExtension] = useState(false);
  const started = useRef(false);

  async function extract(input: ExtractInput) {
    setPending(true);
    setError(null);
    setDuplicate(null);
    setBlocked(null);
    const r = await extractListingAction(input);
    setPending(false);
    if (r.ok) {
      setReview({ url: r.url, values: r.values, missing: r.missing, images: r.images, videos: r.videos, source: r.imageSource });
      setSelected(new Set(r.images));
    } else {
      setError(r.error);
      setDuplicate(r.duplicate ?? null);
      setBlocked(r.blocked?.portal ?? null);
    }
  }

  /** Opens the listing where the extension reads it and sends it back (a new CRM tab). */
  function openWithExtension(listingUrl: string) {
    window.open(`${listingUrl}${EXTENSION_HANDOFF}`, "_blank", "noopener");
    setHandedOff(true);
  }

  function submitLink() {
    const canonical = canonicalListingUrl(url);
    setHandedOff(false);
    if (!canonical) {
      setError("Adj meg egy érvényes hirdetési linket (https://…).");
      return;
    }
    // Pasted text wins; otherwise portals that block servers go straight to the
    // extension (inside this click, so the browser allows the new tab).
    if (text.trim()) return void extract({ url, text });
    if (blocksServers(canonical) && extension) return openWithExtension(canonical);
    void extract({ url });
  }

  // The extension marks this page and answers a ping; either one counts.
  useEffect(() => {
    const check = () => hasExtension() && setExtension(true);
    const onMessage = (e: MessageEvent) => {
      if (e.source === window && e.origin === window.location.origin && e.data?.type === "crm-extension-pong") setExtension(true);
    };
    window.addEventListener("message", onMessage);
    check();
    window.postMessage({ type: "crm-extension-ping" }, window.location.origin);
    const t = setTimeout(() => {
      check();
      window.postMessage({ type: "crm-extension-ping" }, window.location.origin);
    }, 800);
    return () => {
      clearTimeout(t);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // A payload from the browser extension arrives once, in the address fragment.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const payload = decodePayload(window.location.hash);
    if (!payload) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    // Reading the address fragment is an external source, so state is set from here once.
    /* eslint-disable react-hooks/set-state-in-effect */
    setFromExtension(true);
    if (payload.kind === "profile") {
      setProfile(payload);
      return;
    }
    setUrl(payload.url);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Only portal pages are read automatically; anything else waits for a click.
    const canonical = canonicalListingUrl(payload.url);
    if (aiEnabled && canonical && portalOf(new URL(canonical))) {
      void extract({ url: payload.url, text: payload.text, structured: payload.structured ?? null, images: payload.images, videos: payload.videos });
    } else {
      setText(payload.text);
      setShowPaste(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setReview(null);
    setUrl("");
    setText("");
    setShowPaste(false);
    setError(null);
    setDuplicate(null);
    setBlocked(null);
    setHandedOff(false);
  }

  if (review) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 rounded-2xl border border-accent/20 bg-accent-soft px-5 py-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-ink">
            <Sparkles className="size-4 text-accent" /> Az AI kitöltötte a hirdetésből – ellenőrizd, és mentsd el.
          </p>
          <p className="text-text">
            Forrás:{" "}
            <a href={review.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              {review.url} <ExternalLink className="size-3.5" />
            </a>
            . Piszkozatként kerül be; az aktív státuszt te állítod be.
          </p>
          {review.missing.length > 0 && <p className="text-muted">A hirdetésben nem szerepelt: {review.missing.join(", ")}.</p>}
          <button type="button" onClick={reset} className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <RotateCcw className="size-3.5" /> Másik hirdetés
          </button>
        </div>
        <ImportPhotos sourceUrl={review.url} images={review.images} videos={review.videos} source={review.source} selected={selected} onChange={setSelected} />
        {/* The chosen photos are uploaded on the property page once the listing is saved. */}
        <div onSubmitCapture={() => savePending(review.url, { images: review.images.filter((u) => selected.has(u)), source: review.source })}>
          <PropertyForm key={review.url} action={createPropertyAction} owners={owners} initialValues={review.values} submitLabel="Ingatlan mentése" cancelHref="/properties" />
        </div>
      </div>
    );
  }

  if (profile) return <ProfileList profile={profile} onBack={() => setProfile(null)} />;

  const canonical = canonicalListingUrl(url);
  return (
    <Card className="p-5 sm:p-6">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submitLink();
        }}
      >
        {fromExtension && pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> A bővítménytől kapott hirdetést olvasom… Ha az AI-szolgáltatás épp foglalt, ez egy percig is
            eltarthat.
          </p>
        )}
        <Field label="A hirdetés linkje" htmlFor="listing-url" hint="Pl. https://ingatlan.com/34567890 – az adatokat, a fotókat és a videólinkeket is átvesszük.">
          <Input id="listing-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
        </Field>

        {showPaste && (
          <Field label="A hirdetés oldalának szövege" htmlFor="listing-text" hint="Nyisd meg a hirdetést, nyomj Ctrl+A-t, majd Ctrl+C-t, és illeszd be ide. Így fotók nélkül kerül át.">
            <Textarea id="listing-text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-48" placeholder="Illeszd be az oldal szövegét…" />
          </Field>
        )}

        {handedOff && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-ink">
            <Puzzle className="mt-0.5 size-4 shrink-0 text-accent" />
            Megnyitottam a hirdetést egy új lapon. A bővítmény beolvassa, és egy új CRM-lapon megnyitja az ellenőrzést, a fotókkal együtt.
          </p>
        )}

        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <p className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                {error}
                {duplicate && (
                  <>
                    {" "}
                    <Link href={`/properties/${duplicate.id}`} className="font-medium underline">
                      Megnyitás: {duplicate.title}
                    </Link>
                  </>
                )}
              </span>
            </p>
            {blocked && (
              <div className="flex flex-wrap items-center gap-2 text-ink">
                {/* Offered even when the extension wasn't detected: if it's installed, it works; if not, the listing just opens. */}
                {canonical && (
                  <Button size="sm" onClick={() => openWithExtension(canonical)}>
                    <Puzzle /> Megnyitás a bővítménnyel
                  </Button>
                )}
                {!extension && (
                  <span className="basis-full text-xs text-text">
                    Nem látom a bővítményt ezen az oldalon. Ha még nincs telepítve: Chrome → <code>chrome://extensions</code> → Fejlesztői mód → „Kicsomagolt bővítmény betöltése” → a projekt <code>extension</code> mappája.
                    Ha már telepítve van, kattints a kártyáján a frissítés ikonra, majd töltsd újra ezt az oldalt.
                  </span>
                )}
                {!showPaste && (
                  <Button size="sm" variant="secondary" onClick={() => setShowPaste(true)}>
                    <ClipboardPaste /> Inkább beillesztem a szövegét
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!aiEnabled || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Link2 />} {pending ? "Hirdetés beolvasása…" : "Importálás"}
          </Button>
          <p className="text-xs text-muted">
            {extension ? "A bővítmény telepítve: az ingatlan.com hirdetéseit is be tudom olvasni." : "Semmi nem mentődik, amíg az ellenőrzés után rá nem nyomsz a mentésre."}
          </p>
        </div>
        {!aiEnabled && <p className="text-sm text-warning">Az AI-szolgáltatás még nincs beállítva, ezért az importálás nem érhető el.</p>}
      </form>
    </Card>
  );
}
