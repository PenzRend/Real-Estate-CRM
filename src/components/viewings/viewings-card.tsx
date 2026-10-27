"use client";

import { CalendarCheck, CalendarClock, CalendarPlus, ExternalLink, Loader2, MapPin, MessageSquareText, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { addToCalendarAction, cancelViewingAction } from "@/app/(app)/viewings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Viewing } from "@/lib/viewings/data";
import { awaitingFeedback, calendarMessages, enableCalendarHref, outcomeLabels, statusLabels } from "@/lib/viewings/logic";
import { FeedbackDialog } from "./feedback-dialog";
import { ViewingDialog } from "./viewing-dialog";

const day = new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", timeZone: "Europe/Budapest" });
const time = new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
const weekday = new Intl.DateTimeFormat("hu-HU", { weekday: "short", timeZone: "Europe/Budapest" });

/** "Foglalás" button that opens the booking dialog for a client or a listing. */
export function BookViewingButton({ clientId, propertyId, variant = "primary" }: { clientId?: string; propertyId?: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <CalendarPlus /> Megtekintés foglalása
      </Button>
      {open && <ViewingDialog mode="book" clientId={clientId} propertyId={propertyId} onClose={() => setOpen(false)} />}
    </>
  );
}

/** One-off message after the Google Calendar consent round trip. */
function CalendarNotice() {
  const params = useSearchParams();
  const enabled = params.get("calendar_enabled");
  const refused = params.get("mail_error") === "calendar_scope";
  if (enabled == null && !refused) return null;
  const added = Number(enabled);
  const problem = calendarMessages[params.get("calendar_problem") as keyof typeof calendarMessages] ?? null;
  return (
    <p role="status" className={cn("mx-5 mt-4 rounded-xl px-3 py-2 text-sm", refused ? "bg-danger-soft text-danger" : problem ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
      {refused
        ? "A Google-engedélyezésnél a naptár-hozzáférés nem lett bepipálva, így a naptár nincs engedélyezve."
        : problem
          ? `A naptár-engedély megvan, de ${added > 0 ? `csak ${added} megtekintés került be a naptáradba` : "a megtekintések nem kerültek be a naptáradba"}. ${problem}`
          : `A Google Naptár engedélyezve.${added > 0 ? ` ${added} megtekintés bekerült a naptáradba.` : ""}`}
    </p>
  );
}

function ViewingRow({
  v,
  now,
  showClient,
  showProperty,
  onOpen,
}: {
  v: Viewing;
  now: Date;
  showClient: boolean;
  showProperty: boolean;
  onOpen: (dialog: "feedback" | "edit") => void;
}) {
  const pathname = usePathname();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<"calendar" | "cancel" | null>(null);
  const [message, setMessage] = useState<{ text: string; permission?: boolean } | null>(null);
  const waiting = awaitingFeedback(v, now);
  const upcoming = v.status === "scheduled" && !waiting;
  const start = new Date(v.startsAt);

  async function toCalendar() {
    setBusy("calendar");
    const r = await addToCalendarAction(v.id, false).catch(() => "failed" as const);
    setBusy(null);
    if (r === "needs_permission") {
      window.location.href = enableCalendarHref(pathname);
      return;
    }
    const text = calendarMessages[r];
    if (text) setMessage({ text });
  }

  async function cancel() {
    setBusy("cancel");
    const r = await cancelViewingAction(v.id).catch(() => ({ ok: false as const, error: "A lemondás nem sikerült." }));
    setBusy(null);
    setConfirmCancel(false);
    if (!r.ok) setMessage({ text: r.error });
    else if (r.calendar !== "skipped" && r.calendar !== "updated") setMessage({ text: calendarMessages[r.calendar] ?? "" });
  }

  return (
    <li className="flex gap-4 px-5 py-4">
      <div className={cn("flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5 text-center", waiting ? "bg-warning-soft text-warning" : upcoming ? "bg-accent-soft text-accent" : "bg-surface text-muted")}>
        <span className="text-[11px] font-medium uppercase">{weekday.format(start)}</span>
        <span className="text-sm font-semibold text-ink">{day.format(start)}</span>
        <span className="text-xs tabular-nums">{time.format(start)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showClient && (
            <Link href={`/clients/${v.client.id}`} className="text-sm font-medium text-ink hover:underline">
              {v.client.name}
            </Link>
          )}
          {showClient && showProperty && <span className="text-subtle">·</span>}
          {showProperty && (
            <Link href={`/properties/${v.property.id}`} className={cn("truncate text-sm hover:underline", showClient ? "text-text" : "font-medium text-ink")}>
              {v.property.name}
            </Link>
          )}
          {waiting ? (
            <Badge tone="warning">Visszajelzésre vár</Badge>
          ) : v.status === "completed" && v.interest ? (
            <Badge tone={v.interest === "high" ? "success" : v.interest === "medium" ? "accent" : "neutral"}>{outcomeLabels[v.interest]}</Badge>
          ) : (
            v.status !== "scheduled" && <Badge>{statusLabels[v.status]}</Badge>
          )}
        </div>
        {v.location && (
          <p className="flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="size-3 shrink-0" /> {v.location}
          </p>
        )}
        {v.feedback && <p className="line-clamp-2 text-xs text-text">„{v.feedback}”</p>}
        {v.status === "scheduled" && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {waiting && (
              <button
                type="button"
                onClick={() => onOpen("feedback")}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover"
              >
                <MessageSquareText className="size-3.5" /> Hogy sikerült?
              </button>
            )}
            {v.calendar?.link ? (
              <a href={v.calendar.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-success hover:bg-surface">
                <CalendarCheck className="size-3.5" /> Naptárban <ExternalLink className="size-3" />
              </a>
            ) : (
              upcoming &&
              !v.calendar && (
                <button type="button" onClick={toCalendar} disabled={busy != null} className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50">
                  {busy === "calendar" ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />} Naptárba
                </button>
              )
            )}
            {upcoming && (
              <button type="button" onClick={() => onOpen("edit")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink">
                <Pencil className="size-3.5" /> Módosítás
              </button>
            )}
            {confirmCancel ? (
              <span className="inline-flex items-center gap-1.5 text-xs">
                Lemondod{v.calendar?.mine ? " (a naptárból is törlődik)" : ""}?
                <button type="button" onClick={cancel} disabled={busy != null} className="rounded-full bg-danger px-2.5 py-1 font-medium text-white disabled:opacity-50">
                  {busy === "cancel" ? <Loader2 className="size-3.5 animate-spin" /> : "Igen"}
                </button>
                <button type="button" onClick={() => setConfirmCancel(false)} className="rounded-full px-2 py-1 font-medium text-muted hover:text-ink">
                  Nem
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmCancel(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-danger">
                <X className="size-3.5" /> Lemondás
              </button>
            )}
          </div>
        )}
        {message?.text && <p className="text-xs text-warning">{message.text}</p>}
      </div>
    </li>
  );
}

/**
 * Viewings of the dashboard, a client or a listing: what's coming, what
 * waits for feedback ("Hogy sikerült?"), and what was said afterwards.
 */
export function ViewingsCard({
  viewings,
  now,
  title = "Megtekintések",
  showClient = true,
  showProperty = true,
  book,
  empty,
}: {
  viewings: Viewing[];
  /** Server time (ISO), so "waiting for feedback" matches the server render. */
  now: string;
  title?: string;
  showClient?: boolean;
  showProperty?: boolean;
  book?: { clientId?: string; propertyId?: string };
  empty: string;
}) {
  const [booking, setBooking] = useState(false);
  // Held here, not in the row: a saved answer removes the row from open lists.
  const [open, setOpen] = useState<{ dialog: "feedback" | "edit"; viewing: Viewing } | null>(null);
  const at = new Date(now);
  const waiting = viewings.filter((v) => awaitingFeedback(v, at)).length;
  return (
    <Card>
      <CardHeader
        title={title}
        count={viewings.length}
        action={
          book ? (
            <button type="button" onClick={() => setBooking(true)} className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-accent">
              <Plus className="size-4" /> Foglalás
            </button>
          ) : waiting > 0 ? (
            <Badge tone="warning">{waiting} visszajelzésre vár</Badge>
          ) : (
            <CalendarClock className="size-4 text-muted" />
          )
        }
      />
      <CalendarNotice />
      {viewings.length ? (
        <ul className="divide-y divide-border">
          {viewings.map((v) => (
            <ViewingRow key={v.id} v={v} now={at} showClient={showClient} showProperty={showProperty} onOpen={(dialog) => setOpen({ dialog, viewing: v })} />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">{empty}</p>
      )}
      {open?.dialog === "feedback" && <FeedbackDialog viewing={open.viewing} onClose={() => setOpen(null)} />}
      {open?.dialog === "edit" && <ViewingDialog mode="edit" viewing={open.viewing} onClose={() => setOpen(null)} />}
      {booking && book && <ViewingDialog mode="book" clientId={book.clientId} propertyId={book.propertyId} onClose={() => setBooking(false)} />}
    </Card>
  );
}
