"use client";

import { Check, ImageOff, Loader2, PlayCircle } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { cn } from "@/lib/cn";
import { previewUrl, type PendingSelection } from "@/lib/listings/pending-media";

/** Photos found on the listing, all selected by default; the agent can untick any. */
export function ImportPhotos({
  sourceUrl,
  images,
  videos,
  source,
  selected,
  onChange,
}: {
  sourceUrl: string;
  images: string[];
  videos: string[];
  source: PendingSelection["source"];
  selected: Set<string>;
  onChange: Dispatch<SetStateAction<Set<string>>>;
}) {
  // Messages arrive outside React's render; keep the latest setter for them.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [broken, setBroken] = useState<Set<string>>(new Set());
  // The extension's downloads arrive one by one; reload previews as they do.
  const [arrivals, setArrivals] = useState(0);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin || e.data?.type !== "crm-import-image") return;
      if (e.data.ok === false && typeof e.data.url === "string") markBroken(e.data.url);
      else setArrivals((n) => n + 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(images.map(async (u) => [u, await previewUrl(sourceUrl, u, source)] as const)).then((pairs) => {
      if (!cancelled) setPreviews(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [images, sourceUrl, source, arrivals]);

  function markBroken(u: string) {
    setBroken((b) => new Set(b).add(u));
    onChangeRef.current((prev) => {
      const next = new Set(prev);
      next.delete(u);
      return next;
    });
  }

  if (!images.length && !videos.length) return null;
  const usable = images.filter((u) => !broken.has(u));
  const count = usable.filter((u) => selected.has(u)).length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      {images.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              Fotók a hirdetésből: {count} / {usable.length} kiválasztva
            </p>
            <div className="flex gap-3 text-xs font-medium">
              <button type="button" onClick={() => onChange(new Set(usable))} className="text-muted hover:text-ink">
                Mind
              </button>
              <button type="button" onClick={() => onChange(new Set())} className="text-muted hover:text-ink">
                Egyik sem
              </button>
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {images.map((u) => {
              const on = selected.has(u) && !broken.has(u);
              return (
                <li key={u}>
                  <button
                    type="button"
                    disabled={broken.has(u)}
                    onClick={() => {
                      const next = new Set(selected);
                      if (next.has(u)) next.delete(u);
                      else next.add(u);
                      onChange(next);
                    }}
                    aria-pressed={on}
                    className={cn("relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-strong", on ? "ring-2 ring-ink" : "opacity-50")}
                  >
                    {broken.has(u) ? (
                      <span className="grid size-full place-items-center text-subtle" title="Ezt a fotót nem sikerült letölteni">
                        <ImageOff className="size-4" />
                      </span>
                    ) : previews[u] ? (
                      // Previews of the listing's own photos (object URLs or the CRM's portal pass-through).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[u]!} alt="" className="size-full object-cover" onError={() => markBroken(u)} />
                    ) : (
                      <span className="grid size-full place-items-center" title="Letöltés folyamatban">
                        <Loader2 className="size-4 animate-spin text-subtle" />
                      </span>
                    )}
                    {on && (
                      <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-ink text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">Mentés után feltöltjük őket az ingatlanhoz, átméretezve, helyadatok nélkül. Csak a saját hirdetésed fotóit importáld.</p>
        </>
      )}
      {videos.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {videos.map((v) => (
            <li key={v} className="flex items-center gap-1.5 text-text">
              <PlayCircle className="size-4 text-muted" /> Videó / virtuális séta: {new URL(v).hostname.replace(/^www\./, "")} – a linket az adatlapra mentjük.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
