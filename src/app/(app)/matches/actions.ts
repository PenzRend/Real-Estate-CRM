"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function decide(propertyId: string, clientId: string, status: "dismissed" | "task_created") {
  if (!UUID.test(propertyId) || !UUID.test(clientId)) throw new Error("Invalid match ids");
  const user = await getCurrentUser();
  const supabase = await createClient();
  // The composite foreign keys reject a property or client from another workspace.
  const { error } = await supabase
    .from("property_client_matches")
    .upsert(
      { organization_id: user.organization.id, property_id: propertyId, client_id: clientId, status },
      { onConflict: "property_id,client_id" },
    );
  if (error) throw new Error(`Failed to save match decision: ${error.code}`);
  return { user, supabase };
}

/** "Nem releváns": hides the pair from lists and suggestions. */
export async function dismissMatchAction(propertyId: string, clientId: string) {
  await decide(propertyId, clientId, "dismissed");
  refresh();
}
