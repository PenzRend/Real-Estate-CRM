"use client";

import { Building2, ChevronDown, Download, Handshake, Loader2, Search, UserRound, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { fillTemplateAction } from "@/app/(app)/documents/actions";
import { searchShareableAction } from "@/app/(app)/messages/actions";
import { Button } from "@/components/ui/button";
import { FIELD_HELP } from "@/lib/office-docs/fields";

type Kind = "client" | "property" | "deal";
type Pick = { kind: Kind; id: string; title: string; detail: string | null };
const icons = { client: UserRound, property: Building2, deal: Handshake } as const;
const labels = { client: "Ügyfél", property: "Ingatlan", deal: "Ügylet" } as const;

/** "Kitöltés" on a Word template: pick a deal (or a client and a listing), and download the filled copy. */
export function FillTemplate({ documentId, title }: { documentId: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [picks, setPicks] = useState<Partial<Record<Kind, Pick>>>({});
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Pick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => void searchShareableAction(q).then((r) => live && setHits(r)), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  function fill() {
    setError(null);
    start(async () => {
      const r = await fillTemplateAction(documentId, { clientId: picks.client?.id, propertyId: picks.property?.id, dealId: picks.deal?.id }).catch(() => ({ ok: false as const, error: "A kitöltés nem sikerült." }));
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: r.fileName });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      dialog.current?.close();
    });
  }

  const shown = query.trim().length < 2 ? [] : hits;
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-accent hover:bg-accent-soft"
        title="Kitöltés ügyfél, ingatlan vagy ügylet adataival"
      >
        <Wand2 className="size-4" /> Kitöltés
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
        aria-label="Sablon kitöltése"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg tracking-tight">{title} kitöltése</h2>
            <p className="mt-1 text-sm text-muted">Válassz egy ügyletet (vevő, eladó, ingatlan és összegek együtt), vagy egy ügyfelet és egy ingatlant. A kitöltött példány letöltődik; a sablon nem változik.</p>
          </div>

          {Object.values(picks).length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {(Object.values(picks) as Pick[]).map((p) => {
                const Icon = icons[p.kind];
                return (
                  <li key={p.kind} className="pop-in flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-sm">
                    <Icon className="size-4 shrink-0 text-accent" />
                    <span className="text-xs text-muted">{labels[p.kind]}:</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{p.title}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPicks((cur) => {
                          const next = { ...cur };
                          delete next[p.kind];
                          return next;
                        })
                      }
                      className="grid size-6 place-items-center rounded-full text-muted hover:bg-background hover:text-ink"
                      aria-label={`${labels[p.kind]} elvetése`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ügylet, ügyfél vagy ingatlan keresése"
                aria-label="Keresés"
                className="h-11 w-full rounded-2xl border border-border pr-3 pl-9 text-sm focus:border-ink focus:outline-none"
              />
            </label>
            {shown.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-y-auto">
                {shown.map((h) => {
                  const Icon = icons[h.kind];
                  return (
                    <li key={`${h.kind}-${h.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicks((p) => ({ ...p, [h.kind]: h }));
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface"
                      >
                        <Icon className="size-4 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{h.title}</span>
                          <span className="block truncate text-xs text-muted">
                            {labels[h.kind]}
                            {h.detail && ` · ${h.detail}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border">
            <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-muted hover:text-ink">
              Milyen mezők lehetnek a sablonban?
              <ChevronDown className={`size-4 transition-transform ${help ? "rotate-180" : ""}`} />
            </button>
            {help && (
              <div className="reveal max-h-56 overflow-y-auto border-t border-border px-4 py-3 text-xs">
                <p className="mb-2 text-muted">Írd a Word-dokumentumba kapcsos zárójelben, pl. „Vevő: {"{vevo_nev}"}”.</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {FIELD_HELP.map((f) => (
                    <div key={f.key} className="contents">
                      <dt className="font-mono text-ink">{`{${f.key}}`}</dt>
                      <dd className="text-muted">{f.label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialog.current?.close()}>
              Mégse
            </Button>
            <Button onClick={fill} disabled={busy || !Object.values(picks).length}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />} Kitöltés és letöltés
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
