"use client";

import { Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, Mail, RotateCcw, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { draftReplyAction, markVisitAction, sendReplyAction, syncIfStaleAction } from "@/app/(app)/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AwayDraft, AwayItem, AwaySummary } from "@/lib/away/data";
import { gmailComposeUrl } from "@/lib/away/logic";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/i18n/format";
import { findPlaceholders } from "@/lib/mail/compose";

// Drafts written automatically on arrival, one at a time (provider rate limits).
const AUTO_DRAFTS = 3;
const FOLLOW_UP_DAYS = 2;
const ENABLE_SEND_HREF = "/api/mail/google/connect?send=1&next=/dashboard";

type DraftState = { status: "idle" | "loading" | "error"; draft: AwayDraft | null; error?: string };
type Sent = { at: string; logged: "client" | "property" | null };

type Mailbox = AwaySummary["mailbox"];

function DraftEditor({
  emailId,
  draft,
  mailbox,
  hasClient,
  onRewrite,
  onSent,
  busy,
}: {
  emailId: string;
  draft: AwayDraft;
  mailbox: Mailbox;
  hasClient: boolean;
  onRewrite: () => void;
  onSent: (s: Sent) => void;
  busy: boolean;
}) {
  const [to, setTo] = useState(draft.to ?? "");
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body ?? "");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [followUp, setFollowUp] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  const gaps = findPlaceholders(`${subject}\n${body}`);
  const canSend = Boolean(mailbox?.canSend) && !needsPermission;
  const ready = gaps.length === 0 && to.trim() !== "" && subject.trim() !== "" && body.trim() !== "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    const r = await sendReplyAction({ emailId, to, subject, body, followUpDays: hasClient && followUp ? FOLLOW_UP_DAYS : null });
    setSending(false);
    if (r.ok) onSent({ at: r.sentAt, logged: r.logged });
    else {
      setConfirming(false);
      setError(r.error);
      if (r.needsPermission) setNeedsPermission(true);
    }
  }

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none";
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-surface p-3 sm:p-4">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Címzett
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Add meg a címzettet" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Tárgy
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Szöveg
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(14, body.split("\n").length + 2)} className={cn(field, "resize-y leading-relaxed")} />
      </label>

      {gaps.length > 0 ? (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
          Küldés előtt töltsd ki: <span className="font-medium">{gaps.join(", ")}</span>
        </p>
      ) : (
        <p className="text-xs text-muted">Ellenőrizd a szöveget. Csak akkor megy el, ha megnyomod a Küldést.</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border-strong bg-background p-3">
          <p className="text-sm text-ink">
            Elküldöd innen: <span className="font-medium">{mailbox?.email}</span>
            <br />
            ide: <span className="font-medium">{to}</span> – „{subject}”?
          </p>
          {hasClient && (
            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Emlékeztess {FOLLOW_UP_DAYS} nap múlva, ha nem válaszol
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Igen, elküldöm
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">
              Mégse
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canSend ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!ready}
              title={ready ? undefined : "Előbb töltsd ki a címzettet és a szögletes zárójeles részeket."}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-40"
            >
              <Send className="size-3.5" /> Küldés
            </button>
          ) : (
            mailbox && (
              <a
                href={ENABLE_SEND_HREF}
                title="Egyszeri Google-engedély. A CRM csak akkor küld, ha megnyomod a Küldést."
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
              >
                <ShieldCheck className="size-3.5" /> Küldés engedélyezése
              </a>
            )
          )}
          <a
            href={gmailComposeUrl({ account: mailbox?.email ?? null, to: to.trim() || null, subject, body })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-background px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-strong"
          >
            <ExternalLink className="size-3.5" /> Megnyitás Gmailben
          </a>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-background px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-strong">
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} {copied ? "Másolva" : "Másolás"}
          </button>
          <button type="button" onClick={onRewrite} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-50">
            <RotateCcw className="size-3.5" /> Újraírás
          </button>
        </div>
      )}
    </div>
  );
}

const loggedText: Record<NonNullable<Sent["logged"]> | "none", string> = {
  client: "rögzítve az ügyfél idővonalán",
  property: "rögzítve az ingatlannál – mentsd el ügyfélként is",
  none: "mentsd el ügyfélként, hogy nyoma maradjon",
};

function AwayRow({
  item,
  state,
  mailbox,
  aiEnabled,
  onDraft,
}: {
  item: AwayItem;
  state: DraftState;
  mailbox: Mailbox;
  aiEnabled: boolean;
  onDraft: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<Sent | null>(item.repliedAt ? { at: item.repliedAt, logged: null } : null);
  const router = useRouter();
  const draft = state.draft;
  const sender = item.fromName ?? item.fromEmail ?? "Ismeretlen";
  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{sender}</p>
          {item.portal && <Badge tone="accent">{item.portal}</Badge>}
          {item.client ? (
            <Link href={`/clients/${item.client.id}`} className="inline-flex">
              <Badge tone="success">
                <UserRound className="size-3" /> {item.client.name}
              </Badge>
            </Link>
          ) : (
            <Badge tone="warning">Új érdeklődő?</Badge>
          )}
          <span className="ml-auto text-xs text-subtle">
            {!item.isNew && "korábbi · "}
            {formatDateTime(item.receivedAt)}
          </span>
        </div>
        <p className="truncate text-sm text-text">{item.subject ?? "(nincs tárgy)"}</p>
        {draft?.summary ? (
          <p className="flex gap-1.5 text-sm text-text">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" /> {draft.summary}
          </p>
        ) : (
          item.snippet && <p className="line-clamp-2 text-xs text-muted">{item.snippet}</p>
        )}
        {draft?.nextStep && !sent && <p className="text-xs font-medium text-ink">→ {draft.nextStep}</p>}
      </div>

      {sent ? (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="size-4" /> Válasz elküldve {formatDateTime(sent.at)}
          <span className="text-muted">· {loggedText[item.client ? "client" : (sent.logged ?? "none")]}</span>
          {!item.client && (
            <Link href={`/interactions/new?email=${item.id}`} className="ml-1 font-medium text-ink hover:text-accent">
              Rögzítés a CRM-ben →
            </Link>
          )}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {draft?.body ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-surface"
            >
              <Mail className="size-3.5" /> Válaszvázlat <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
          ) : draft ? (
            <span className="text-xs text-muted">Erre a levélre nem kell válasz.</span>
          ) : state.status === "loading" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Vázlat készül…
            </span>
          ) : (
            aiEnabled && (
              <button type="button" onClick={onDraft} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-surface">
                <Sparkles className="size-3.5" /> Válaszvázlat írása
              </button>
            )
          )}
          <Link href={`/interactions/new?email=${item.id}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink">
            Rögzítés a CRM-ben
          </Link>
          {state.status === "error" && <span className="text-xs text-danger">{state.error}</span>}
        </div>
      )}

      {open && !sent && draft?.body && (
        // Keyed by the draft so a rewrite replaces the edited text.
        <DraftEditor
          key={`${draft.subject}|${draft.body}`}
          emailId={item.id}
          draft={draft}
          mailbox={mailbox}
          hasClient={Boolean(item.client)}
          busy={state.status === "loading"}
          onRewrite={onDraft}
          onSent={(s) => {
            setSent(s);
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </li>
  );
}

const notices: Record<string, { tone: "success" | "danger"; text: string }> = {
  send_enabled: { tone: "success", text: "A küldés engedélyezve. A válaszvázlatokat mostantól innen is elküldheted." },
  send_scope: { tone: "danger", text: "A Google-engedélyezésnél a küldési jog nem lett bepipálva, így a küldés nincs engedélyezve." },
  denied: { tone: "danger", text: "A Google-engedélyezést megszakítottad." },
};

export function AwayPanel({ summary, aiEnabled, notice }: { summary: AwaySummary; aiEnabled: boolean; notice?: string | null }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, DraftState>>(() =>
    Object.fromEntries(summary.items.map((i) => [i.id, { status: "idle", draft: i.draft }])),
  );
  const started = useRef(false);

  // Items that appear after a sync have no state yet; their draft comes from the server.
  const current = (s: Record<string, DraftState>, id: string): DraftState =>
    s[id] ?? { status: "idle", draft: summary.items.find((i) => i.id === id)?.draft ?? null };

  async function draft(id: string) {
    setStates((s) => ({ ...s, [id]: { ...current(s, id), status: "loading" } }));
    const r = await draftReplyAction(id);
    setStates((s) => ({ ...s, [id]: r.ok ? { status: "idle", draft: r.draft } : { ...current(s, id), status: "error", error: r.error } }));
    return r.ok;
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void markVisitAction();
    void (async () => {
      const stored = await syncIfStaleAction().catch(() => 0);
      if (stored > 0) router.refresh();
      if (!aiEnabled) return;
      for (const item of summary.items.filter((i) => !i.draft && !i.repliedAt).slice(0, AUTO_DRAFTS)) {
        if (!(await draft(item.id))) break; // stop on rate limits or errors
      }
    })();
    // Runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quiet = !summary.headline;
  const shown = notice ? notices[notice] : null;
  return (
    <Card>
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg">{summary.firstVisit ? "Az elmúlt 24 órában" : "Mi történt, amíg távol voltál"}</h2>
        <p className="text-xs text-muted">
          {formatDateTime(summary.since)} óta
          {summary.mailbox?.lastSyncedAt && ` · levelek frissítve: ${formatDateTime(summary.mailbox.lastSyncedAt)}`}
        </p>
      </div>
      {shown && (
        <p role="status" className={cn("mx-5 mt-4 rounded-xl px-3 py-2 text-sm", shown.tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
          {shown.text}
        </p>
      )}
      <div className="px-5 pt-4">
        <p className={cn("text-[15px]", quiet ? "text-muted" : "text-ink")}>
          {summary.headline ?? "Nyugis időszak: azóta nem érkezett új levél, és nem lett esedékes teendő."}
          {summary.items.some((i) => !i.isNew && !i.repliedAt) && <span className="text-muted"> Korábbról még válaszra vár:</span>}
        </p>
        {!summary.mailbox && (
          <p className="mt-1 text-sm text-muted">
            <Link href="/inbox" className="font-medium text-ink underline-offset-2 hover:underline">
              Kösd be a Gmailt
            </Link>
            , és itt látod a beérkezett érdeklődéseket, kész válaszvázlattal.
          </p>
        )}
      </div>
      {summary.items.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {summary.items.map((item) => (
            <AwayRow
              key={item.id}
              item={item}
              state={states[item.id] ?? { status: "idle", draft: item.draft }}
              mailbox={summary.mailbox}
              aiEnabled={aiEnabled}
              onDraft={() => void draft(item.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="pb-4" />
      )}
      {summary.olderNewCount > 0 && (
        <div className="border-t border-border px-5 py-3 text-sm">
          <Link href="/inbox" className="font-medium text-ink hover:text-accent">
            További {summary.olderNewCount} válaszra váró levél a Levelekben →
          </Link>
        </div>
      )}
    </Card>
  );
}
