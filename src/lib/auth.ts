import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, timezone").eq("id", userId).single(),
    supabase
      .from("organization_members")
      .select("role, organizations (id, name)")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .single(),
  ]);

  // A valid session without a profile means the sign-up trigger did not run
  // (e.g. the migration is missing). Treat as signed out rather than crash.
  // Many-to-one embed: an object at runtime; typed as an array until DB types are generated.
  const org = [membership?.organizations].flat()[0];
  if (!profile || !membership || !org) redirect("/auth/signout?error=profile");

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
