import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth";

/**
 * The user a background job acts for, as getCurrentUser() would describe them
 * — but only while they still belong to the workspace (a removed agent's
 * mailbox is not synced into a workspace they left).
 */
export async function jobUser(admin: SupabaseClient, userId: string, organizationId: string): Promise<CurrentUser | null> {
  const [{ data: member }, { data: profile }, { data: org }] = await Promise.all([
    admin.from("organization_members").select("role").eq("user_id", userId).eq("organization_id", organizationId).maybeSingle(),
    admin.from("profiles").select("full_name, email, timezone").eq("id", userId).maybeSingle(),
    admin.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
  ]);
  if (!member || !profile || !org) return null;
  const fullName = (profile.full_name as string | null) ?? null;
  return {
    id: userId,
    email: profile.email as string,
    fullName,
    firstName: fullName ? fullName.trim().split(/\s+/).slice(-1)[0] : null,
    timezone: (profile.timezone as string | null) ?? "Europe/Budapest",
    organization: { id: organizationId, name: org.name as string, role: member.role as CurrentUser["organization"]["role"] },
  };
}
