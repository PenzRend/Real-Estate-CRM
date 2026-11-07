"use client";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { importMailAction, readMailAction } from "@/app/(app)/inbox/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/i18n/format";
import type { BrowsedMail } from "@/lib/mail/browse";

function Row({ mailboxId, m, ownEmail }: { mailboxId: string; m: BrowsedMail; ownEmail: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startRead] = useTransition();
  const [importing, startImport] = useTransition();
  const outgoing = m.from?.email === ownEmail.toLowerCase();
  const who = outgoing ? `→ ${m.to.join(", ") || "(nincs címzett)"}` : (m.from?.name ?? m.from?.email ?? "Ismeretlen");

  function toggle() {
    setOpen((o) => !o);
    if (body !== null || reading) return;
    startRead(async () => {
      const r = await readMailAction(mailboxId, m.ref).catch(actionFailed);
      if (r.ok) setBody(r.body);
      else setError(r.error);
    });
  }

  function process() {
    setError(null);
    startImport(async () => {
      // On success the action moves on to processing; only a failure comes back.
      const r = await importMailAction(mailboxId, m.ref).catch(actionFailed);
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <li className="flex flex-col gap-2 px-5 py-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <button type="button" onClick={toggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{who}</p>
            {m.storedId && <Badge tone="success">A Flavióban</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-text">{m.subject ?? "(nincs tárgy)"}</p>
          {m.snippet && !open && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{m.snippet}</p>}
          <p className="mt-1 flex items-center gap-1 text-xs text-subtle">
            {m.at ? formatDateTime(new Date(m.at)) : ""}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {m.storedId ? (
            <Link href={`/interactions/new?email=${m.storedId}`} className={buttonClasses("secondary", "xs")}>
              <Sparkles /> Feldolgozás
            </Link>
          ) : (
            <Button variant="secondary" size="xs" onClick={process} disabled={importing} title="Átveszi a levelet a Flavióba, és megnyitja feldolgozásra">
              {importing ? <Loader2 className="animate-spin" /> : <Sparkles />} Feldolgozás
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="reveal rounded-xl bg-surface px-4 py-3 text-sm text-text">
          {reading ? (
            <p className="flex items-center gap-2 text-muted">
              <Loader2 className="size-4 animate-spin" /> Betöltés…
            </p>
          ) : (
            body !== null && <p className="max-h-96 overflow-y-auto break-words whitespace-pre-wrap">{body}</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

/** The live mailbox list: open an email in place, or bring it into Flavio for processing. */
export function AllMailList({ mailboxId, ownEmail, items }: { mailboxId: string; ownEmail: string; items: BrowsedMail[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((m) => (
        <Row key={m.ref} mailboxId={mailboxId} m={m} ownEmail={ownEmail} />
      ))}
    </ul>
  );
}
