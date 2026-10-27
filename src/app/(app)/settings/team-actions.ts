"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, WORKSPACE_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam, hashInviteToken, INVITE_DAYS, inviteLink, listTeam, listWorkspaces, newInviteToken } from "@/lib/team";

export type InviteResult = { ok: true; email: string; link: string } | { ok: false; error: string };

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adj meg egy érvényes e-mail-címet.").max(320),
  role: z.enum(["member", "admin"]),
});

const expiry = () => new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();

/** Creates an invitation and returns its link. An earlier open invite to the same address is replaced. */
export async function inviteMemberAction(input: { email: string; role: string }): Promise<InviteResult> {
  const user = await getCurrentUser();
  if (!canManageTeam(user)) return { ok: false, error: "Csak a tulajdonos és az adminok hívhatnak meg munkatársat." };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, role } = parsed.data;
  // Only the owner makes admins: an admin cannot hand out more than they have.
  if (role === "admin" && user.organization.role !== "owner") return { ok: false, error: "Admint csak a tulajdonos hívhat meg." };

  const { members } = await listTeam(user);
  if (members.some((m) => m.email.toLowerCase() === email)) return { ok: false, error: "Ő már tagja a munkaterületnek." };

  const supabase = await createClient();
  await supabase
    .from("organization_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", user.organization.id)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const token = newInviteToken();
  const { error } = await supabase
    .from("organization_invitations")
    .insert({ organization_id: user.organization.id, email, role, token_hash: hashInviteToken(token), invited_by: user.id, expires_at: expiry() });
  if (error) {
    console.error("invite", error.message);
    return { ok: false, error: "A meghívót nem sikerült létrehozni. Próbáld újra." };
  }
  refresh();
  return { ok: true, email, link: await inviteLink(token) };
}

/** A fresh link (and 14 more days) for an open invitation; the old link stops working. */
export async function renewInviteAction(id: string): Promise<InviteResult> {
  const user = await getCurrentUser();
  if (!canManageTeam(user) || !z.uuid().safeParse(id).success) return { ok: false, error: "A meghívó nem található." };
  const token = newInviteToken();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_invitations")
    .update({ token_hash: hashInviteToken(token), expires_at: expiry() })
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("email")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "A meghívó már nem nyitott. Hívd meg újra." };
  refresh();
  return { ok: true, email: data.email, link: await inviteLink(token) };
}

export async function revokeInviteAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!canManageTeam(user) || !z.uuid().safeParse(id).success) return { ok: false, error: "A meghívó nem található." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .is("accepted_at", null);
  if (error) return { ok: false, error: "A visszavonás nem sikerült. Próbáld újra." };
  refresh();
  return { ok: true };
}

/** Removes a colleague from the workspace. Their records stay; RLS decides who may remove whom. */
export async function removeMemberAction(userId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!canManageTeam(user) || userId === user.id || !z.uuid().safeParse(userId).success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("organization_members").delete().eq("organization_id", user.organization.id).eq("user_id", userId);
  if (error) console.error("remove member", error.message);
  refresh();
}

/** Leaves the current workspace and goes back to the next one (at least the personal one). */
export async function leaveWorkspaceAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user.organization.role === "owner") return;
  const supabase = await createClient();
  const { error } = await supabase.from("organization_members").delete().eq("organization_id", user.organization.id).eq("user_id", user.id);
  if (error) {
    console.error("leave workspace", error.message);
    return;
  }
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/dashboard");
}

export async function switchWorkspaceAction(organizationId: string): Promise<void> {
  const user = await getCurrentUser();
  const workspaces = await listWorkspaces(user);
  if (!workspaces.some((w) => w.id === organizationId)) return;
  (await cookies()).set(WORKSPACE_COOKIE, organizationId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
