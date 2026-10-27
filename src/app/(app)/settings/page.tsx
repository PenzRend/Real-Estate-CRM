import { ArrowRight, LogOut, Mail, Puzzle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { TeamInvites } from "@/components/settings/team";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { FormSubmit } from "@/components/ui/form-submit";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { googleConfig } from "@/lib/mail/google";
import { getMailbox } from "@/lib/mail/sync";
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

async function TeamSection({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const [{ members, pending }, workspaces] = await Promise.all([listTeam(user), listWorkspaces(user)]);
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
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-strong text-xs font-medium text-ink">{initials(m.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                {m.name}
                {m.userId === user.id && <span className="text-xs font-normal text-muted">(te)</span>}
              </p>
              <p className="truncate text-xs text-muted">{m.email}</p>
            </div>
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
  const mailbox = googleConfig() && isMailCryptoConfigured() ? await getMailbox(user) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Beállítások" description="A fiókod, a munkaterületed és a kapcsolódó szolgáltatások." />

      <div>
        <FormSection number="01" title="Profil">
          <div className="sm:col-span-2">
            <ProfileForm
              fullName={user.fullName ?? ""}
              email={user.email}
              workspaceName={user.organization.name}
              canRename={user.organization.role !== "member"}
            />
          </div>
        </FormSection>

        <TeamSection user={user} />

        <FormSection number="03" title="Kapcsolatok" description="Levelek, naptár és hirdetésimport.">
          <Connection
            icon={Mail}
            title="Gmail és Google Naptár"
            status={
              mailbox ? (
                <span className="flex items-center gap-2">
                  {mailbox.email_address}
                  {mailbox.status === "active" ? <Badge tone="success">Összekapcsolva</Badge> : <Badge tone="warning">Újra kell kapcsolni</Badge>}
                </span>
              ) : (
                "Nincs összekapcsolva"
              )
            }
            href="/inbox"
            cta={mailbox ? "Levelek" : "Összekapcsolás"}
          />
          <Connection
            icon={Puzzle}
            title="Böngészőbővítmény"
            status="Hirdetések átvétele egy kattintással az ingatlan.com-ról és más portálokról."
            href="/properties/import"
            cta="Telepítés"
          />
        </FormSection>

        <FormSection number="04" title="Jelszó">
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
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
