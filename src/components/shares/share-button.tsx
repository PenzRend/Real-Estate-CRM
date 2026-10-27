"use client";

import { Check, Copy, ExternalLink, Eye, Link2, Loader2, Share2, X } from "lucide-react";
import { useRef, useState } from "react";
import { createShareAction, revokeShareAction, updateShareAction } from "@/app/(app)/properties/[id]/share-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { formatDateTime } from "@/lib/i18n/format";
import type { Share } from "@/lib/shares/data";

type Contact = { name: string; phone: string; email: string };

/**
 * "Megosztás": a private link to a client-facing page of the listing. Create
 * it, copy or open it, see how often it was viewed, change the contact shown,
 * or revoke it.
 */
export function ShareButton({ propertyId, share, defaults }: { propertyId: string; share: Share | null; defaults: Contact }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(share?.contactName ?? defaults.name);
  const [phone, setPhone] = useState(share?.contactPhone ?? defaults.phone);
  const [email, setEmail] = useState(share?.contactEmail ?? defaults.email);
  const [showAddress, setShowAddress] = useState(share?.showAddress ?? false);
  const [errors, setErrors] = useState<Partial<Record<"contactPhone" | "contactEmail", string>>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const settings = { showAddress, contactName: name, contactPhone: phone, contactEmail: email };

  async function run(fn: () => Promise<{ ok: boolean; errors?: typeof errors } | void>) {
    setBusy(true);
    setErrors({});
    setSaved(false);
    try {
      const r = await fn();
      if (r && !r.ok && r.errors) setErrors(r.errors);
      else if (r) setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => dialog.current?.showModal()}>
        <Share2 /> Megosztás
      </Button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
        aria-label="Megosztás ügyféllel"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg">Megosztás ügyféllel</h2>
              <p className="mt-1 text-sm text-muted">Privát link egy igényes hirdetésoldalhoz: fotók, adatok, leírás és az elérhetőséged. Belső megjegyzés és a tulajdonos nem látszik.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Bezárás" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
              <X className="size-4" />
            </button>
          </div>

          {share && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 shrink-0 text-muted" />
                <input readOnly value={share.url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none" aria-label="A megosztott link" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={copy}>
                  {copied ? <Check /> : <Copy />} {copied ? "Másolva" : "Link másolása"}
                </Button>
                <a href={share.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-[13px] font-medium text-ink hover:bg-background">
                  <ExternalLink className="size-3.5" /> Megnyitás
                </a>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
                  <Eye className="size-3.5" /> {share.viewCount} megtekintés{share.lastViewedAt ? ` · utoljára ${formatDateTime(share.lastViewedAt)}` : ""}
                </span>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Kapcsolattartó neve az oldalon" htmlFor="share-name">
                <Input id="share-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <Field label="Telefon" htmlFor="share-phone" error={errors.contactPhone}>
              <Input id="share-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+36 30 123 4567" />
            </Field>
            <Field label="E-mail" htmlFor="share-email" error={errors.contactEmail}>
              <Input id="share-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-text sm:col-span-2">
              <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              A pontos cím is látszódjon (alapból csak a település és a kerület)
            </label>
            <p className="text-xs text-muted sm:col-span-2">A hirdetés szövege változatlanul jelenik meg – ha abban szerepel az utca, az látszani fog.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {share ? (
              <Button onClick={() => run(() => updateShareAction(propertyId, settings))} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null} Mentés
              </Button>
            ) : (
              <Button onClick={() => run(() => createShareAction(propertyId, settings))} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Link létrehozása
              </Button>
            )}
            {saved && <span className="text-xs text-success">Elmentve</span>}
            {share &&
              (confirmRevoke ? (
                <span className="ml-auto flex items-center gap-1.5 text-xs">
                  A link azonnal megszűnik.
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => revokeShareAction(propertyId)).then(() => setConfirmRevoke(false))}>
                    Visszavonás
                  </Button>
                  <button type="button" onClick={() => setConfirmRevoke(false)} className="px-1 text-muted hover:text-ink">
                    Mégse
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmRevoke(true)} className="ml-auto text-xs font-medium text-muted hover:text-danger">
                  Link visszavonása
                </button>
              ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
