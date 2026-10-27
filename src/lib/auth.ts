import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The workspace a person in several workspaces last chose. */
export const WORKSPACE_COOKIE = "flavio_workspace";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string | null;
  timezone: string;
  organization: { id: string; name: string; role: "owner" | "admin" | "member" };
};

/**
 * Data access layer entry point: verifies the session (JWT signature checked
 * by getClaims) and loads the user's profile and workspace. Redirects to
 * /login when there is no valid session. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Session checks compare token expiry with the clock, so keep this out of
  // the prerendered shell (cookies() alone resolves there with partial prefetching).
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: memberships }, cookieStore] = await Promise.all([
    supabase.from("profiles").select("full_name, email, timezone").eq("id", userId).single(),
    supabase.from("organization_members").select("role, organizations (id, name, is_personal)").eq("user_id", userId).order("created_at"),
    cookies(),
  ]);

  // Many-to-one embed: an object at runtime; typed as an array until DB types are generated.
  const options = (memberships ?? []).flatMap((m) => {
    const org = [m.organizations].flat()[0] as { id: string; name: string; is_personal: boolean } | undefined;
    return org ? [{ role: m.role, org }] : [];
  });
  // Someone in several workspaces works in the one they last chose; otherwise
  // a team they joined comes before the personal workspace made at sign-up.
  const chosen = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const membership = options.find((o) => o.org.id === chosen) ?? options.find((o) => !o.org.is_personal) ?? options[0];

  // A valid session without a profile means the sign-up trigger did not run
  // (e.g. the migration is missing). Treat as signed out rather than crash.
  if (!profile || !membership) redirect("/auth/signout?error=profile");
  const { org } = membership;

  // Hungarian names are family name first: "Kovács Anna" → "Anna".
  const parts = profile.full_name?.trim().split(/\s+/) ?? [];
  return {
    id: userId,
    email: profile.email,
    fullName: profile.full_name,
    firstName: parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? null),
    timezone: profile.timezone,
    organization: {
      id: org.id,
      name: org.name,
      role: membership.role as CurrentUser["organization"]["role"],
    },
  };
});
