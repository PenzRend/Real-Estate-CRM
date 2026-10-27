import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The browser-tab title of a client or listing page: its name, or the fallback. */
export async function recordTitle(kind: "clients" | "properties", id: string, fallback: string) {
  if (!UUID.test(id)) return fallback;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const column = kind === "clients" ? "full_name" : "title";
  const { data } = await supabase.from(kind).select(column).eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  const name = (data as Record<string, string | null> | null)?.[column];
  return name?.trim() || fallback;
}
