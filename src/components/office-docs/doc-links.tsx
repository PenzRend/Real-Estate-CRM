"use client";

import { Link2, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { linkDocumentAction, unlinkDocumentAction } from "@/app/(app)/documents/actions";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import type { DocLink } from "@/lib/office-docs/links";
import { RecordSearch, recordIcons } from "./record-search";

/** A file's clients, listings and deals as chips; "Kapcsolás" adds one, × removes one. */
export function DocLinks({ documentId, links, canEdit }: { documentId: string; links: DocLink[]; canEdit: boolean }) {
  const [picking, setPicking] = useState(false);
  const [busy, start] = useTransition();
  if (!links.length && !canEdit) return null;
  return (
    <div className="relative mt-1.5 flex flex-wrap items-center gap-1.5">
      {links.map((l) => {
        const Icon = recordIcons[l.kind];
        return (
          <span key={l.linkId} className="pop-in inline-flex max-w-full items-center gap-1 rounded-full bg-surface py-0.5 pr-1 pl-2 text-xs text-ink">
            <Icon className="size-3 shrink-0 text-accent" />
            <Link href={l.href} className="max-w-48 truncate hover:underline">
              {l.title}
            </Link>
            {l.source !== "manual" && <Sparkles className="size-3 shrink-0 text-subtle" aria-label={l.source === "ai" ? "AI kapcsolta" : "Sablon kapcsolta"} />}
            {canEdit && (
              <button
                type="button"
                onClick={() => start(() => unlinkDocumentAction(l.linkId).catch(actionFailed).then(() => undefined))}
                className="grid size-4 place-items-center rounded-full text-subtle hover:bg-background hover:text-danger"
                aria-label={`${l.title} leválasztása`}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
      {canEdit && (
        <button type="button" onClick={() => setPicking((p) => !p)} aria-expanded={picking} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted hover:bg-surface hover:text-ink">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />} Kapcsolás
        </button>
      )}
      {picking && (
        <div className="pop-in absolute top-full left-0 z-30 mt-1 w-80 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-background p-2 shadow-float [--pop-from:-4px]">
          <RecordSearch
            onClose={() => setPicking(false)}
            onPick={(r) => {
              setPicking(false);
              start(async () => {
                const res = await linkDocumentAction(documentId, r).catch(actionFailed);
                if (!res.ok) toast({ message: res.error });
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
