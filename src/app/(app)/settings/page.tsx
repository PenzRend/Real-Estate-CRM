import { ArrowRight, CalendarDays, Download, LogOut, Mail, MessageSquare, Puzzle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReopenTourButton } from "@/components/app-shell/product-tour";
import { NotificationsSetting } from "@/components/settings/notifications";
import { PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { TeamInvites } from "@/components/settings/team";
import { LeadAssignment } from "@/components/team/lead-assignment";
import { leadSettings } from "@/lib/team/office-data";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { FormSubmit } from "@/components/ui/form-submit";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { buttonClasses } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import { ListingFeed } from "@/components/portal/listing-feed";
import { feedStatus } from "@/lib/portal/feed";
import { PhoneKeys } from "@/components/phone/phone-keys";
import { listPhoneKeys } from "@/lib/phone/calls";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { isPlatformAdmin } from "@/lib/admin";
import { aiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { listSubscriptions } from "@/lib/calendar/data";
import { hasCalendarFeed } from "@/lib/calendar/feed";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { mailboxLabel } from "@/lib/mail/provider";
import { listMailboxes } from "@/lib/mail/sync";
import { canManageTeam, listTeam, listWorkspaces, roleLabels } from "@/lib/team";
import { leaveWorkspaceAction, removeMemberAction, switchWorkspaceAction } from "./team-actions";

export const metadata: Metadata = { title: "Beállítások" };

function Connection({ icon: Icon, title, status, href, cta }: { icon: typeof Mail; title: string; status: ReactNode; href: string; cta: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-surface sm:col-span-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted group-hover:bg-background">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <div className="mt-0.5 truncate text-sm text-muted">{status}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}


async function TeamSection({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const [{ members, pending }, workspaces, leads] = await Promise.all([listTeam(user), listWorkspaces(user), leadSettings(user)]);
  const manage = canManageTeam(user);
  // The owner removes anyone; an admin removes members only (the database enforces the same).
  const canRemove = (role: string) => role !== "owner" && (user.organization.role === "owner" || (manage && role === "member"));

  return (
    <FormSection
      number="02"
      title="Csapat"
      description={manage ? "Hívd meg a kollégáidat: ugyanazokat az ügyfeleket, ingatlanokat és feladatokat látják. A levelezésed és a naptárad a tiéd marad." : "A munkaterület tagjai. Az ügyfeleket, ingatlanokat és feladatokat közösen látjátok."}
    >
      <ul className="divide-y divide-border rounded-2xl border border-border sm:col-span-2">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
            <UserAvatar name={m.name} url={m.avatarUrl} size="sm" className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                {m.name}
                {m.userId === user.id && <span className="text-xs font-normal text-muted">(te)</span>}
              </p>
              <p className="truncate text-xs text-muted">
                {m.email}
              </p>
            </div>
            {m.userId !== user.id && (
              <Link href={`/messages?with=${m.userId}`} className={buttonClasses("ghost", "xs")}>
                <MessageSquare /> Üzenet
              </Link>
            )}
            <Badge tone={m.role === "member" ? "neutral" : "accent"}>{roleLabels[m.role]}</Badge>
            {m.userId !== user.id && canRemove(m.role) && (
              <ConfirmAction
                action={removeMemberAction.bind(null, m.userId)}
                trigger="Eltávolítás"
                size="xs"
                title={`${m.name} eltávolítása`}
                description="Nem fér hozzá többé a munkaterülethez. Az általa rögzített ügyfelek, ingatlanok és előzmények megmaradnak."
                confirmLabel="Eltávolítás"
                tone="danger"
              />
            )}
          </li>
        ))}
      </ul>

      {manage && members.length > 1 && (
        <LeadAssignment mode={leads.mode} members={members.map((m) => ({ userId: m.userId, name: m.name, inRotation: leads.inRotation.has(m.userId) }))} />
      )}

      {manage && (
        <TeamInvites
          canInviteAdmins={user.organization.role === "owner"}
          inviter={user.fullName ?? user.email}
          workspace={user.organization.name}
          pending={pending.map((p) => ({ ...p }))}
        />
      )}

      {workspaces.length > 1 && (
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Munkaterületeid</p>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {workspaces.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm text-ink">{w.name}</p>
                {w.id === user.organization.id ? (
                  <Badge tone="success">Ebben dolgozol</Badge>
                ) : (
                  <form action={switchWorkspaceAction.bind(null, w.id)}>
                    <FormSubmit className={buttonClasses("secondary", "xs")}>Váltás</FormSubmit>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {user.organization.role !== "owner" && (
        <div className="sm:col-span-2">
          <ConfirmAction
            action={leaveWorkspaceAction}
            trigger={
              <>
                <LogOut className="size-4" /> Kilépés a munkaterületről
              </>
            }
            size="sm"
            title="Kilépés a munkaterületről"
            description="Nem látod többé a csapat ügyfeleit és ingatlanait. Újra csak meghívóval csatlakozhatsz."
            confirmLabel="Kilépés"
            tone="danger"
          />
        </div>
      )}
    </FormSection>
  );
}

async function SettingsContent() {
  const user = await getCurrentUser();
  const [mailboxes, feedActive, calendars, feed, phoneKeys, ai] = await Promise.all([isMailCryptoConfigured() ? listMailboxes(user) : [], hasCalendarFeed(user), listSubscriptions(user), feedStatus(user), listPhoneKeys(user), aiUsage(user)]);
  // One line on the calendars: which are shown in Flavio, and whether the subscription link is on.
  const calendarParts = [
    ...mailboxes.filter((m) => m.can_calendar && m.status !== "revoked").map((m) => (m.provider === "outlook" ? "Outlook-naptár" : "Google Naptár")),
    ...(calendars.some((c) => c.kind === "caldav") ? ["iCloud-naptár"] : []),
    ...(calendars.some((c) => c.kind === "ics") ? [`${calendars.filter((c) => c.kind === "ics").length} naptár linkkel`] : []),
    ...(feedActive ? ["feliratkozási link aktív"] : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Beállítások" description="A fiókod, a munkaterületed és a kapcsolódó szolgáltatások." />

      <div>
        <FormSection number="01" title="Profil">
          <div className="sm:col-span-2">
            <ProfileForm
              userId={user.id}
              fullName={user.fullName ?? ""}
              email={user.email}
              avatarUrl={user.avatarUrl}
              workspaceName={user.organization.name}
              canRename={user.organization.role !== "member"}
            />
          </div>
        </FormSection>

        <TeamSection user={user} />

        <FormSection number="03" title="Kapcsolatok" description="Értesítések, levelek, naptár, hirdetésimport és -export.">
          <div id="ertesitesek" className="scroll-mt-24">
            <NotificationsSetting publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
          </div>
          <Connection
            icon={Mail}
            title={mailboxes.length > 1 ? `${mailboxes.length} postafiók` : "E-mail (Gmail, Outlook, céges, iCloud…)"}
            status={
              mailboxes.length ? (
                <span className="flex flex-col gap-1 whitespace-normal">
                  {mailboxes.map((m) => (
                    <span key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="break-all">{m.email_address}</span>
                      <span className="text-subtle">· {mailboxLabel(m.provider, m.email_address)}</span>
                      {m.status !== "active" && <Badge tone="warning">{m.status === "revoked" ? "Újra kell kapcsolni" : "Hiba"}</Badge>}
                    </span>
                  ))}
                </span>
              ) : (
                "Nincs összekapcsolva"
              )
            }
            href="/inbox"
            cta={mailboxes.length ? "Kezelés" : "Összekapcsolás"}
          />
          <Connection
            icon={Puzzle}
            title="Böngészőbővítmény"
            status="Hirdetések átvétele egy kattintással az ingatlan.com-ról és más portálokról."
            href="/properties/import"
            cta="Telepítés"
          />
          <Connection
            icon={CalendarDays}
            title="Naptárak (iPhone, Google, Outlook)"
            status={calendarParts.length ? [...new Set(calendarParts)].join(" · ") : "A saját naptáraid a Flavióban, és a megtekintések a telefonod naptárában."}
            href="/settings/calendars"
            cta={calendarParts.length ? "Kezelés" : "Beállítás"}
          />
          <PhoneKeys keys={phoneKeys} appUrl={process.env.ANDROID_APP_URL || null} />
          <ListingFeed active={feed.exists} listings={feed.listings} lastFetchedAt={feed.lastFetchedAt} canManage={canManageTeam(user)} />
        </FormSection>

        <FormSection number="04" title="Adatok" description="Az összes ügyfél, ingatlan, feladat, előzmény és megtekintés egy Excel-fájlban.">
          {canManageTeam(user) ? (
            <a
              href="/api/export"
              download
              className="group flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-surface sm:col-span-2"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted group-hover:bg-background">
                <Download className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Exportálás Excelbe</p>
                <p className="mt-0.5 text-sm text-muted">Munkalaponként: ügyfelek, ingatlanok, feladatok, előzmények, megtekintések.</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
                Letöltés <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ) : (
            <p className="text-sm text-muted sm:col-span-2">Az exportálást a munkaterület tulajdonosa vagy egy admin végezheti.</p>
          )}
          <p id="ai-keret" className="scroll-mt-24 text-sm text-muted sm:col-span-2">
            AI-használat ma: <span className="font-medium text-ink tabular-nums">{ai.today} / {ai.dailyLimit}</span> hívás (éjfélkor újraindul)
            {ai.monthlyLimit !== null && (
              <>
                , ebben a hónapban: <span className="font-medium text-ink tabular-nums">{ai.month} / {ai.monthlyLimit}</span> hívás (a hónap elején újraindul)
              </>
            )}
            .
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-ink">Bemutató</p>
              <p className="mt-0.5 text-sm text-muted">Egy perces körbevezetés: mi hol van a Flavióban.</p>
            </div>
            <ReopenTourButton />
          </div>
          {isPlatformAdmin(user) && (
            <Connection icon={ShieldCheck} title="Pilot admin" status="Meghívókódok és a munkaterületek AI-keretei." href="/admin" cta="Megnyitás" />
          )}
        </FormSection>

        <FormSection number="05" title="Jelszó">
          <div className="sm:col-span-2">
            <PasswordForm />
          </div>
        </FormSection>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PageSuspense>
      <SettingsContent />
    </PageSuspense>
  );
}
