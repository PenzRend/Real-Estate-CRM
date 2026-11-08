import { Suspense, type ReactNode } from "react";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { CalendarConnections } from "@/components/calendar/connections";
import { ConnectionsDialog } from "@/components/calendar/connections-dialog";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth";
import { listSubscriptions } from "@/lib/calendar/data";
import { listMailboxes } from "@/lib/mail/sync";
import { BookingLinkDialog } from "@/components/booking/booking-link-dialog";
import { DEFAULT_BOOKING, myBookingLink } from "@/lib/booking/data";

/** "Naptárak": the connections popup, with a dot when a calendar needs attention. */
async function Connections() {
  const user = await getCurrentUser();
  const [subscriptions, mailboxes] = await Promise.all([listSubscriptions(user), listMailboxes(user).catch(() => [])]);
  const attention = subscriptions.some((s) => s.lastError) || mailboxes.some((m) => m.can_calendar && m.status === "revoked");
  return (
    <ConnectionsDialog attention={attention}>
      <CalendarConnections user={user} returnTo="/calendar" />
    </ConnectionsDialog>
  );
}

/** "Foglalási link": the agent's own booking page for clients. */
async function BookingLinkButton() {
  const link = await myBookingLink(await getCurrentUser()).catch(() => null);
  return <BookingLinkDialog link={link} defaults={DEFAULT_BOOKING} />;
}

/** What stays while the calendar pages through months and weeks: the header and the toolbar. Only the grid (page.tsx) loads. */
export default function CalendarLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition>
      <div data-wide className="flex flex-col gap-6">
        <PageHeader
          title="Naptár"
          description="Megtekintések, feladatok és a saját naptáraid egy helyen."
          actions={
            <Suspense fallback={<div className="h-9 w-36 shimmer rounded-full bg-surface" />}>
              <BookingLinkButton />
            </Suspense>
          }
        />
        <Suspense fallback={<div className="h-[42px] shimmer rounded-xl bg-surface" />}>
          <CalendarToolbar
            connections={
              <Suspense fallback={<div className="h-8 w-28 shimmer rounded-full bg-surface" />}>
                <Connections />
              </Suspense>
            }
          />
        </Suspense>
        {children}
      </div>
    </PageTransition>
  );
}
