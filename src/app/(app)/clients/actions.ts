"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseClientForm, type ClientFieldErrors } from "@/lib/validation/client";

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

export async function archiveClientAction(id: string) {
  await setArchived(id, true);
  redirect(`/clients/${id}`);
}

export async function restoreClientAction(id: string) {
  await setArchived(id, false);
  redirect(`/clients/${id}`);
}
