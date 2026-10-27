import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";
import { hashSecretToken as hashInviteToken } from "@/lib/secret-token";
import { createClient } from "@/lib/supabase/server";

export type Role = CurrentUser["organization"]["role"];
export const roleLabels: Record<Role, string> = { owner: "Tulajdonos", admin: "Admin", member: "Munkatárs" };

export const INVITE_DAYS = 14;

export { hashSecretToken as hashInviteToken, newSecretToken as newInviteToken } from "@/lib/secret-token";

export async function inviteLink(token: string) {
  return `${await appOrigin()}/invite/${token}`;
}

/** Can invite colleagues and remove members. */
export const canManageTeam = (user: CurrentUser) => user.organization.role !== "member";

export type TeamMember = { userId: string; name: string; email: string; role: Role; joinedAt: string };
export type PendingInvite = { id: string; email: string; role: Role; expiresAt: string; expired: boolean };

export async function listTeam(user: CurrentUser, now = new Date()) {
  const supabase = await createClient();
  const [{ data: rows, error }, invites] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, created_at, profiles (full_name, email)")
      .eq("organization_id", user.organization.id)
      .order("created_at"),
    canManageTeam(user)
      ? supabase
          .from("organization_invitations")
          .select("id, email, role, expires_at")
          .eq("organization_id", user.organization.id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(`listTeam failed: ${error.message}`);

  const members: TeamMember[] = (rows ?? []).map((r) => {
    // Many-to-one embed: an object at runtime; typed as an array until DB types are generated.
    const p = [r.profiles].flat()[0] as { full_name: string | null; email: string } | undefined;
    return { userId: r.user_id, name: p?.full_name || p?.email || "—", email: p?.email ?? "", role: r.role as Role, joinedAt: r.created_at };
  });
  const pending: PendingInvite[] = (invites.data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role as Role,
    expiresAt: i.expires_at,
    expired: Date.parse(i.expires_at) < now.getTime(),
  }));
  return { members, pending };
}

/** Every workspace the user belongs to, for switching when there is more than one. */
export async function listWorkspaces(user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase.from("organization_members").select("role, organizations (id, name)").eq("user_id", user.id).order("created_at");
  return (data ?? []).flatMap((m) => {
    const org = [m.organizations].flat()[0] as { id: string; name: string } | undefined;
    return org ? [{ id: org.id, name: org.name, role: m.role as Role }] : [];
  });
}

/** The invitation as the invite page shows it, before or after sign-in. */
export async function invitationPreview(token: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_preview", { p_token_hash: hashInviteToken(token) });
  const row = [data].flat()[0] as { organization_name: string; invited_by_name: string | null; email: string; status: "open" | "accepted" | "revoked" | "expired" } | undefined;
  return row ?? null;
}

const acceptErrors: Record<string, string> = {
  invite_not_found: "Ez a meghívó nem létezik. Kérj új linket attól, aki meghívott.",
  invite_closed: "Ez a meghívó lejárt vagy visszavonták. Kérj új linket attól, aki meghívott.",
  invite_used: "Ezt a meghívót már valaki felhasználta. Kérj új linket attól, aki meghívott.",
  invite_wrong_email: "Ez a meghívó egy másik e-mail-címre szól. Jelentkezz be azzal a címmel, amelyre a meghívót kaptad.",
};

/** Joins the signed-in user; returns the workspace id or a message to show. */
export async function acceptInvitation(token: string): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token_hash: hashInviteToken(token) });
  if (error) {
    const known = Object.keys(acceptErrors).find((code) => error.message.includes(code));
    if (!known) console.error("accept_invitation", error.message);
    return { ok: false, error: known ? acceptErrors[known] : "A csatlakozás nem sikerült. Próbáld újra." };
  }
  return { ok: true, organizationId: data as string };
}
