"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Marks the welcome walkthrough as seen, so it is not shown again on its own. */
export async function finishTourAction() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ tour_seen_at: new Date().toISOString() }).eq("id", user.id).is("tour_seen_at", null);
}
