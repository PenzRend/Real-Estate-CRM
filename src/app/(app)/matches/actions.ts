"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MatchDecisionResult = { ok: true } | { ok: false; error: string };

/**
 * "Nem releváns": hides the pair from lists and suggestions. No refresh: the
 * row stays put with an undo link, and leaves the list on the next visit.
 */
export async function dismissMatchAction(propertyId: string, clientId: string): Promise<MatchDecisionResult> {
  if (!UUID.test(propertyId) || !UUID.test(clientId)) return { ok: false, error: "Ismeretlen ingatlan vagy ügyfél." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  // The composite foreign keys reject a property or client from another workspace.
  const { error } = await supabase
    .from("property_client_matches")
    .upsert(
      { organization_id: user.organization.id, property_id: propertyId, client_id: clientId, status: "dismissed" },
      { onConflict: "property_id,client_id" },
    );
  if (error) {
    console.error("match dismiss failed", error.code);
    return { ok: false, error: "Nem sikerült elrejteni. Próbáld újra." };
  }
  return { ok: true };
}

/** Undo for "Nem releváns": the pair is suggested again. */
export async function undoDismissMatchAction(propertyId: string, clientId: string): Promise<MatchDecisionResult> {
  if (!UUID.test(propertyId) || !UUID.test(clientId)) return { ok: false, error: "Ismeretlen ingatlan vagy ügyfél." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("property_client_matches")
    .delete()
    .eq("organization_id", user.organization.id)
    .eq("property_id", propertyId)
    .eq("client_id", clientId)
    .eq("status", "dismissed");
  if (error) {
    console.error("match undo failed", error.code);
    return { ok: false, error: "A visszavonás nem sikerült. Próbáld újra." };
  }
  return { ok: true };
}
