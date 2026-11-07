"use client";

import { Building2, Handshake, Loader2, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { searchShareableAction } from "@/app/(app)/messages/actions";

export type RecordHit = { kind: "client" | "property" | "deal"; id: string; title: string; detail: string | null };
export const recordIcons = { client: UserRound, property: Building2, deal: Handshake } as const;
export const recordLabels = { client: "Ügyfél", property: "Ingatlan", deal: "Ügylet" } as const;

/** Search clients, listings and deals and pick one. */
const placeholders: Record<RecordHit["kind"], string> = { client: "Ügyfél keresése", property: "Ingatlan keresése", deal: "Ügylet keresése" };

export function RecordSearch({
  onPick,
  onClose,
  autoFocus = true,
  only,
}: {
  onPick: (r: RecordHit) => void;
  onClose?: () => void;
  autoFocus?: boolean;
  /** Only this kind of record (e.g. a listing when the question is which one was viewed). */
  only?: RecordHit["kind"];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<RecordHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      setLoading(true);
      void searchShareableAction(q)
        .then((r) => live && setHits(r))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const shown = query.trim().length < 2 ? [] : only ? hits.filter((h) => h.kind === only) : hits;
  return (
    <div className="flex flex-col gap-1">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose?.()}
          placeholder={only ? placeholders[only] : "Ügyfél, ingatlan vagy ügylet keresése"}
          aria-label={only ? placeholders[only] : "Ügyfél, ingatlan vagy ügylet keresése"}
          className="h-10 w-full rounded-xl border border-border bg-background pr-9 pl-9 text-sm focus:border-ink focus:outline-none"
        />
        {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-subtle" />}
      </label>
      {shown.length > 0 && (
        <ul className="max-h-56 overflow-y-auto">
          {shown.map((h) => {
            const Icon = recordIcons[h.kind];
            return (
              <li key={`${h.kind}-${h.id}`}>
                <button type="button" onClick={() => onPick(h)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface">
                  <Icon className="size-4 shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{h.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {recordLabels[h.kind]}
                      {h.detail && ` · ${h.detail}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {query.trim().length >= 2 && !loading && !shown.length && <p className="px-3 py-2 text-sm text-muted">Nincs találat.</p>}
    </div>
  );
}
