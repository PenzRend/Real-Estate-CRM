import { CalendarSources, type CalendarAccount } from "@/components/calendar/sources";
import { Subscriptions } from "@/components/calendar/subscriptions";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import type { CurrentUser } from "@/lib/auth";
import { listSubscriptions } from "@/lib/calendar/data";
import { hasCalendarFeed } from "@/lib/calendar/feed";
import { isICloudEmail } from "@/lib/mail/app-password";
import { configuredProviders } from "@/lib/mail/configured";
import { listMailboxes } from "@/lib/mail/sync";

/**
 * Everything about connecting calendars, both ways: outside calendars shown in
 * Flavio (iCloud, Google, Outlook, links), and Flavio's viewings in other
 * calendar apps. On the Naptár page (in a popup) and in Beállítások → Naptárak;
 * `returnTo` is where Google / Microsoft sign-ins come back to.
 */
export async function CalendarConnections({ user, returnTo }: { user: CurrentUser; returnTo: string }) {
  const [subscriptions, mailboxes, feedActive] = await Promise.all([listSubscriptions(user), listMailboxes(user).catch(() => []), hasCalendarFeed(user)]);
  const accounts: CalendarAccount[] = mailboxes.flatMap((m) =>
    m.provider !== "imap" && m.status !== "revoked" ? [{ id: m.id, email: m.email_address, provider: m.provider, canCalendar: m.can_calendar }] : [],
  );
  const icloudMailboxes = mailboxes.filter((m) => m.provider === "imap" && m.status !== "revoked" && isICloudEmail(m.email_address)).map((m) => ({ id: m.id, email: m.email_address }));
  const configured = configuredProviders().filter((p): p is CalendarAccount["provider"] => p !== "imap");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h3 className="text-lg">Naptáraid a Flavióban</h3>
        <p className="text-sm text-muted">Az iPhone-od, a Google- és az Outlook-naptárad – csak te látod őket.</p>
        <CalendarSources
          accounts={accounts}
          configured={configured}
          calendars={subscriptions.filter((s) => s.kind === "caldav")}
          icloudMailboxes={icloudMailboxes}
          appleId={user.email}
          returnTo={returnTo}
        />
        <Subscriptions subscriptions={subscriptions.filter((s) => s.kind === "ics")} />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg">A Flavio a többi naptáradban</h3>
        <p className="text-sm text-muted">
          A foglalt megtekintések maguktól bekerülnek a Google- vagy Outlook-naptáradba (ha engedélyezted), feliratkozással pedig bármelyik naptárba: iPhone,
          Mac, Android, Outlook, Thunderbird…
        </p>
        <div className="grid grid-cols-1">
          <CalendarFeed active={feedActive} />
        </div>
      </section>
    </div>
  );
}
