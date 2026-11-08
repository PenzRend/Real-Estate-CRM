"use client";

import { ArrowRight, Loader2, Reply } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { draftReplyAction } from "@/app/(app)/dashboard/actions";
import { DraftEditor } from "@/components/dashboard/away-panel";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import type { AwayDraft, AwayMailbox } from "@/lib/away/data";

/**
 * "Válasz és feldolgozás" on a new email: Flavio drafts the reply, the agent
 * checks and sends it, then the email is processed like with "Feldolgozás"
 * (client, notes, tasks). Renders the row's buttons (its own first, then
 * `children`) and, once open, the editor below them across the whole row.
 */
export function ReplyAndProcess({ emailId, mailbox, hasClient, children }: { emailId: string; mailbox: AwayMailbox | null; hasClient: boolean; children?: ReactNode }) {
  const [draft, setDraft] = useState<AwayDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const process = `/interactions/new?email=${emailId}`;

  async function write() {
    setLoading(true);
    const r = await draftReplyAction(emailId).catch(actionFailed);
    setLoading(false);
    if (!r.ok) return toast({ message: r.error });
    setDraft(r.draft);
  }

  return (
    <>
      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => (draft ? setDraft(null) : void write())} disabled={loading} className={buttonClasses("primary", "xs")}>
          {loading ? <Loader2 className="animate-spin" /> : <Reply />} Válasz és feldolgozás
        </button>
        {children}
      </span>
      {draft && (
        <div className="min-w-0 basis-full">
          <DraftEditor
            emailId={emailId}
            draft={draft}
            mailbox={mailbox}
            hasClient={hasClient}
            busy={loading}
            returnTo="/inbox"
            onRewrite={() => void write()}
            onSent={() => {
              toast({ message: "Elküldve. Most rögzítsük, mi történt." });
              router.push(process);
            }}
          />
          <Link href={process} className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            Máshonnan válaszoltam – jöhet a feldolgozás <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </>
  );
}
