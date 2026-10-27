"use client";

import { CalendarDays, Check, CircleAlert, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { renewCalendarFeedAction } from "@/app/(app)/settings/calendar-actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";

/** The calendar subscription link: viewings in Apple Calendar, Outlook or any calendar app. */
export function CalendarFeed({ active }: { active: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await renewCalendarFeedAction().catch(actionFailed);
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
          <CalendarDays className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Apple Naptár, Outlook és más naptárak</p>
          <p className="mt-0.5 text-sm text-muted">A megtekintéseid maguktól megjelennek iPhone-on, Macen vagy bármely naptárban, ami feliratkozási linket fogad.</p>
        </div>
      </div>

      {url ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-3" role="status">
          <Input value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Naptár feliratkozási link" className="bg-background text-xs" />
          <div className="flex flex-wrap gap-2">
            <a href={url.replace(/^https?:/, "webcal:")} className={buttonClasses("primary", "sm")}>
              <CalendarDays className="size-4" /> Hozzáadás a naptárhoz
            </a>
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
            iPhone-on és Macen a „Hozzáadás a naptárhoz” megnyitja a Naptár appot. Outlookban: Naptár hozzáadása → Feliratkozás az internetről; Google Naptárban: Egyéb naptárak → URL-ről, és illeszd be a linket. A link titkos: aki ismeri, látja a megtekintéseidet.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant={active ? "secondary" : "primary"} onClick={create} disabled={busy}>
            {busy ? "Létrehozás…" : active ? "Új link létrehozása" : "Feliratkozási link létrehozása"}
          </Button>
          {active && <p className="text-xs text-muted">Már van aktív linked. Új link esetén a régi megszűnik, így újra fel kell iratkoznod.</p>}
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
