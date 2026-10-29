import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { hashSecretToken, newSecretToken } from "@/lib/secret-token";
import { createClient } from "@/lib/supabase/server";
import type { CallReport } from "./report";

// Phone keys: the agent's Android phone reports calls with one of these
// (docs/ANDROID-CALLS.md). Only the hash is stored; the key is shown once.

export type PhoneKey = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

export async function listPhoneKeys(user: CurrentUser): Promise<PhoneKey[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("phone_keys")
    .select("id, label, created_at, last_used_at")
    .eq("organization_id", user.organization.id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((k) => ({ id: k.id, label: k.label, createdAt: k.created_at, lastUsedAt: k.last_used_at }));
}

/** A new key for the user's phone; returns it (shown once). */
export async function createPhoneKey(user: CurrentUser, label: string) {
  const token = newSecretToken();
  const supabase = await createClient();
  const { error } = await supabase
    .from("phone_keys")
    .insert({ organization_id: user.organization.id, user_id: user.id, label: label.trim().slice(0, 100) || "Telefon", token_hash: hashSecretToken(token) });
  if (error) throw new Error(`phone key create failed: ${error.message}`);
  return token;
}

export async function revokePhoneKey(user: CurrentUser, id: string) {
  const supabase = await createClient();
  await supabase.from("phone_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
}

export type CallResult = "logged" | "duplicate" | "invalid" | "unknown_number";

/** Records the calls for a key; null when the key is unknown or switched off. */
export async function recordCalls(token: string, calls: CallReport[]): Promise<CallResult[] | null> {
  const supabase = await createClient();
  const results: CallResult[] = [];
  for (const c of calls) {
    const { data, error } = await supabase.rpc("record_phone_call", {
      p_token_hash: hashSecretToken(token),
      p_number: c.number,
      p_direction: c.direction,
      p_started_at: c.startedAt,
      p_duration_seconds: c.durationSeconds,
    });
    if (error) throw new Error(`record_phone_call failed: ${error.message}`);
    if (data == null) return null;
    results.push(data as CallResult);
  }
  return results;
}
