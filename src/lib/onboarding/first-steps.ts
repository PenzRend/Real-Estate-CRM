import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The few things that make Flavio useful on day one, checked from the data
// itself, so the guide shows only what is left and disappears when done.

export type FirstStep = { id: "property" | "client" | "mailbox" | "assistant" | "team"; done: boolean; optional?: boolean };

export async function firstSteps(user: CurrentUser): Promise<FirstStep[]> {
  const supabase = await createClient();
  const org = user.organization.id;
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [properties, clients, mailboxes, asked, members] = await Promise.all([
    count(supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", org)),
    count(supabase.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", org)),
    count(supabase.from("mailboxes").select("id", { count: "exact", head: true }).eq("user_id", user.id)),
    count(supabase.from("ai_processing_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("operation_type", "assistant").eq("status", "success")),
    count(supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", org)),
  ]);
  const steps: FirstStep[] = [
    { id: "property", done: properties > 0 },
    { id: "client", done: clients > 0 },
    { id: "mailbox", done: mailboxes > 0 },
    { id: "assistant", done: asked > 0 },
  ];
  // Only the owner of an office can invite; a one-person office may never need to.
  if (user.organization.role === "owner") steps.push({ id: "team", done: members > 1, optional: true });
  return steps;
}
