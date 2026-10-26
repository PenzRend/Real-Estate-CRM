"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePropertyForm, type PropertyFieldErrors } from "@/lib/validation/property";

export type PropertyFormState = {
  errors?: PropertyFieldErrors;
  formError?: string;
  /** What the user typed, so the form keeps it after a failed submit. */
  values?: Record<string, string>;
};

function submittedValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("$")) values[key] = String(value);
  }
  return values;
}

const SAVE_FAILED = "A mentés nem sikerült. Próbáld újra; ha a hiba megmarad, szólj nekünk.";

/** Maps database errors that the user can fix to a field message. */
function dbFieldError(code: string | undefined, message = ""): PropertyFieldErrors | null {
  // unique (organization_id, source_url): this listing was imported before
  if (code === "23505" && message.includes("source_url")) return { source_url: "Ezt a hirdetést már importáltad." };
  // unique (organization_id, reference_number)
  if (code === "23505") return { reference_number: "Ez a belső azonosító már foglalt." };
  // composite FK: the owner must be a client in this workspace
  if (code === "23503") return { owner_client_id: "A kiválasztott tulajdonos nem található." };
  return null;
}

export async function createPropertyAction(_: PropertyFormState, formData: FormData): Promise<PropertyFormState> {
  const user = await getCurrentUser();
  const parsed = parsePropertyForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: submittedValues(formData) };

  const { video_links: videoLinks, ...fields } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    // organization_id comes from the session, never from the form; RLS checks it again.
    .insert({ ...fields, organization_id: user.organization.id, features: videoLinks?.length ? { video_links: videoLinks } : {} })
    .select("id")
    .single();
  if (error || !data) {
    const errors = dbFieldError(error?.code, error?.message);
    if (errors) return { errors, values: submittedValues(formData) };
    console.error("createPropertyAction failed", error?.code);
    return { formError: SAVE_FAILED, values: submittedValues(formData) };
  }

  redirect(`/properties/${data.id}`);
}

export async function updatePropertyAction(
  id: string,
  _: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const user = await getCurrentUser();
  const parsed = parsePropertyForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: submittedValues(formData) };

  // The import source is set once, at import; the edit form doesn't carry it.
  const changes: Partial<typeof parsed.data> = { ...parsed.data };
  delete changes.source_url;
  delete changes.video_links;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .update(changes)
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .select("id")
    .maybeSingle();
  if (error) {
    const errors = dbFieldError(error.code);
    if (errors) return { errors, values: submittedValues(formData) };
    console.error("updatePropertyAction failed", error.code);
    return { formError: SAVE_FAILED, values: submittedValues(formData) };
  }
  if (!data) return { formError: "Ez az ingatlan nem található, vagy nincs jogosultságod módosítani." };

  redirect(`/properties/${id}`);
}

async function setArchived(id: string, archived: boolean) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  if (error) throw new Error(`Failed to ${archived ? "archive" : "restore"} property: ${error.code}`);
}

export async function archivePropertyAction(id: string) {
  await setArchived(id, true);
  redirect(`/properties/${id}`);
}

export async function restorePropertyAction(id: string) {
  await setArchived(id, false);
  redirect(`/properties/${id}`);
}
