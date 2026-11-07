import { Suspense, type ReactNode } from "react";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { CalendarConnections } from "@/components/calendar/connections";
import { ConnectionsDialog } from "@/components/calendar/connections-dialog";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth";
import { listSubscriptions } from "@/lib/calendar/data";
import { listMailboxes } from "@/lib/mail/sync";

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

/** What stays while the calendar pages through months and weeks: the header and the toolbar. Only the grid (page.tsx) loads. */
export default function CalendarLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition>
      <div data-wide className="flex flex-col gap-6">
        <PageHeader title="Naptár" description="Megtekintések, feladatok, a Google-, Apple- és Outlook-naptárad egy helyen – és a Flavio a többi naptáradban is." />
        <Suspense fallback={<div className="h-10 shimmer rounded-xl bg-surface" />}>
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
