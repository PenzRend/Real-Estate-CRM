import "server-only";
import { cache } from "react";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Whether the office has more than one member: team features (chat, "Csapatnak", Iroda) show only then. Once per request. */
export const hasTeam = cache(async (user: CurrentUser) => {
  const supabase = await createClient();
  const { count } = await supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", user.organization.id);
  return (count ?? 0) > 1;
});
