import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * The service client, which bypasses RLS: only for background jobs that act
 * for every workspace (mail sync, reminders, reports), never for a request
 * made by a user. Null until SUPABASE_SECRET_KEY is set on the server.
 */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
