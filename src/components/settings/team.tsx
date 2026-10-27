"use client";

import { Check, CircleAlert, Copy, Mail, RefreshCw, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { inviteMemberAction, renewInviteAction, revokeInviteAction, type InviteResult } from "@/app/(app)/settings/team-actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import { formatDate } from "@/lib/i18n/format";

type Role = "owner" | "admin" | "member";
const roleLabels: Record<Role, string> = { owner: "Tulajdonos", admin: "Admin", member: "Munkatárs" };

/** The finished invite: the link to copy, or to send from the agent's own email program. */
function InviteLink({ email, link, inviter, workspace, onClose }: { email: string; link: string; inviter: string; workspace: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const subject = `Meghívó a(z) ${workspace} csapatába a Flavióban`;
  const body = `Szia!\n\n${inviter} meghívott a(z) ${workspace} munkaterületre a Flavióban, ahol közösen kezeljük az ügyfeleket, ingatlanokat és feladatokat.\n\nCsatlakozás ezzel a linkkel (a ${email} címmel regisztrálj vagy jelentkezz be):\n${link}\n\nA link 14 napig érvényes.`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4" role="status">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">
          <span className="font-medium">Meghívó elkészült</span> <span className="text-muted">· {email}</span>
        </p>
        <button type="button" onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-background hover:text-ink" aria-label="Bezárás">
          <X className="size-4" />
        </button>
      </div>
      <Input value={link} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Meghívó link" className="bg-background text-xs" />
      <div className="flex flex-wrap gap-2">
        <a href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} className={buttonClasses("primary", "sm")}>
          <Mail className="size-4" /> Küldés e-mailben
        </a>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            navigator.clipboard.writeText(link).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Kimásolva" : "Link másolása"}
        </Button>
      </div>
      <p className="text-xs text-muted">A „Küldés e-mailben” megnyitja a levelezőprogramodat a kész szöveggel. A link 14 napig érvényes, és csak ezzel a címmel működik.</p>
    </div>
  );
}

export function TeamInvites({
  canInviteAdmins,
  inviter,
  workspace,
  pending,
}: {
  canInviteAdmins: boolean;
  inviter: string;
  workspace: string;
  pending: { id: string; email: string; role: Role; expiresAt: string; expired: boolean }[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [result, setResult] = useState<Extract<InviteResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const show = (r: InviteResult) => {
    if (r.ok) {
      setResult(r);
      setError(null);
    } else setError(r.error);
  };

  return (
    <div className="flex flex-col gap-4 sm:col-span-2">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await inviteMemberAction({ email, role }).catch(actionFailed);
            show(r);
            if (r.ok) setEmail("");
          });
        }}
      >
        <div className="flex-1">
          <Field label="Munkatárs e-mail-címe" htmlFor="invite-email">
            <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kollega@iroda.hu" autoComplete="off" />
          </Field>
        </div>
        {canInviteAdmins && (
          <Field label="Szerep" htmlFor="invite-role">
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
              <option value="member">Munkatárs</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        )}
        <Button type="submit" disabled={busy || !email.trim()}>
          <UserPlus className="size-4" /> {busy ? "Meghívás…" : "Meghívás"}
        </Button>
      </form>
      {canInviteAdmins && <p className="-mt-2 text-xs text-muted">Az admin is meghívhat és eltávolíthat munkatársakat, és átnevezheti a munkaterületet.</p>}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}
      {result && <InviteLink {...result} inviter={inviter} workspace={workspace} onClose={() => setResult(null)} />}

      {pending.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Függő meghívók</p>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {pending.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{i.email}</p>
                  <p className="text-xs text-muted">
                    {roleLabels[i.role]} · {i.expired ? "lejárt" : `lejár: ${formatDate(i.expiresAt)}`}
                  </p>
                </div>
                <Button size="xs" variant="secondary" disabled={busy} onClick={() => start(async () => show(await renewInviteAction(i.id).catch(actionFailed)))}>
                  <RefreshCw /> Új link
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const r = await revokeInviteAction(i.id).catch(actionFailed);
                      if (!r.ok) setError(r.error ?? null);
                    })
                  }
                >
                  Visszavonás
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
