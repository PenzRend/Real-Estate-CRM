"use server";

import { onEvent } from "@/lib/automation/events";
import { after } from "next/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { retentionFor } from "@/lib/aml/data";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removeCalendarEvents, upcomingCalendarEvents } from "@/lib/viewings/data";
import { parseClientForm, type ClientFieldErrors } from "@/lib/validation/client";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import { z } from "zod";

export type ClientFormState = {
  errors?: ClientFieldErrors;
  formError?: string;
  /** What the user typed, so the form keeps it after a failed submit. */
  values?: Record<string, string | string[]>;
};

function submittedValues(formData: FormData) {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // React's internal action fields
    const all = formData.getAll(key).map(String);
    values[key] = key === "preferred_property_types" ? all : (all[0] ?? "");
  }
  return values;
}

const SAVE_FAILED = "A mentés nem sikerült. Próbáld újra; ha a hiba megmarad, szólj nekünk.";

export async function createClientAction(_: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const user = await getCurrentUser();
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: submittedValues(formData) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    // organization_id comes from the session, never from the form; RLS checks it again.
    .insert({ ...parsed.data, organization_id: user.organization.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createClientAction failed", error?.code);
    return { formError: SAVE_FAILED, values: submittedValues(formData) };
  }

  // Documents and emails set to go for a new client are made after the response.
  after(() => onEvent(user, { type: "client_created", clientId: data.id }));
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(
  id: string,
  _: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const user = await getCurrentUser();
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: submittedValues(formData) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("updateClientAction failed", error.code);
    return { formError: SAVE_FAILED, values: submittedValues(formData) };
  }
  if (!data) return { formError: "Ez az ügyfél nem található, vagy nincs jogosultságod módosítani." };

  redirect(`/clients/${id}`);
}

async function setArchived(id: string, archived: boolean) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  if (error) throw new Error(`Failed to ${archived ? "archive" : "restore"} client: ${error.code}`);
}

/** Archives or restores in place: the page refreshes, and the toast offers to undo. */
export async function archiveClientAction(id: string) {
  await setArchived(id, true);
  refresh();
}

export async function restoreClientAction(id: string) {
  await setArchived(id, false);
  refresh();
}

export type EraseResult = { ok: false; error: string };

/**
 * GDPR erasure: the client and their conversations, tasks, viewings and
 * emails leave Flavio for good. Owner and admins only, archived clients only
 * (two deliberate steps), and the agent types the name to confirm.
 */
export async function eraseClientAction(id: string, confirmName: string): Promise<EraseResult> {
  const user = await getCurrentUser();
  if (user.organization.role === "member") return { ok: false, error: "Végleges törlést csak a tulajdonos vagy egy admin végezhet." };
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, archived_at")
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (!client) return { ok: false, error: "Az ügyfél nem található." };
  if (!client.archived_at) return { ok: false, error: "Előbb archiváld az ügyfelet." };
  if (confirmName.trim().toLowerCase() !== client.full_name.trim().toLowerCase()) return { ok: false, error: "A beírt név nem egyezik az ügyfél nevével." };
  // The AML act (Pmt.) requires keeping an identified client's data for 8 years.
  const keepUntil = await retentionFor(user, id);
  if (keepUntil && keepUntil > new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: `Az ügyfelet a pénzmosás elleni törvény szerint ${keepUntil.replace(/-/g, ". ")}.-ig meg kell őrizni (azonosítás vagy ügylet miatt), ezért most nem törölhető véglegesen.` };
  }

  // Read the Google Calendar events now: once the viewings are erased, their ids are gone.
  const events = await upcomingCalendarEvents(user, id, new Date());

  const { error } = await supabase.rpc("erase_client", { p_client_id: id });
  if (error) {
    console.error("erase client", error.code, error.message);
    // PGRST202: the database function is not installed yet.
    if (error.code === "PGRST202") return { ok: false, error: "A végleges törlés még nincs bekapcsolva az adatbázisban. Szólj nekünk." };
    return { ok: false, error: "A törlés nem sikerült. Próbáld újra." };
  }
  await removeCalendarEvents(user, events);
  redirect("/clients?erased=1");
}

export type QuickEditResult = { ok: true } | { ok: false; error: string };

const quickEdit = z.object({
  full_name: z.string().trim().min(1, "Add meg az ügyfél nevét.").max(200),
  phone: z.string().trim().max(50),
  email: z.union([z.literal(""), z.email("Érvénytelen e-mail-cím.").max(320)]),
  status: z.enum(["new_lead", "contacted", "qualified", "active", "negotiation", "converted", "lost"]),
  /** Budapest wall-clock time from the form, or empty. */
  next_follow_up_at: z.string().max(20),
});

/** The client's name, status, phone, email and next follow-up, edited in place on their page. */
export async function quickEditClientAction(id: string, input: unknown): Promise<QuickEditResult> {
  const user = await getCurrentUser();
  const parsed = quickEdit.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const followUp = d.next_follow_up_at ? zonedLocalToUtc(d.next_follow_up_at) : null;
  if (d.next_follow_up_at && !followUp) return { ok: false, error: "Érvénytelen időpont." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ full_name: d.full_name, phone: d.phone || null, email: d.email || null, status: d.status, next_follow_up_at: followUp })
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("quickEditClientAction failed", error.code);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!data) return { ok: false, error: "Ez az ügyfél nem található, vagy nincs jogosultságod módosítani." };
  refresh();
  return { ok: true };
}
