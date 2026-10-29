"use server";

import { redirect } from "next/navigation";
import { saveIdentification } from "@/lib/aml/data";
import { getCurrentUser } from "@/lib/auth";

export type IdentificationState = { errors?: Record<string, string>; values?: Record<string, string> };

/** Saves the client's identification (encrypted) and goes back to the client. */
export async function saveIdentificationAction(clientId: string, _prev: IdentificationState, form: FormData): Promise<IdentificationState> {
  const user = await getCurrentUser();
  const kind = form.get("kind") === "company" ? "company" : "person";
  // The form's own fields only (not React's hidden action fields).
  const values = Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$"))) as Record<string, string>;
  const r = await saveIdentification(user, clientId, kind, values);
  if (!r.ok) {
    // An error on a field that isn't on the form also shows at the bottom.
    const unseen = Object.entries(r.errors).filter(([k]) => k !== "form" && !(k in values));
    return { errors: unseen.length && !r.errors.form ? { ...r.errors, form: unseen.map(([, m]) => m).join(" ") } : r.errors, values };
  }
  redirect(`/clients/${clientId}?identified=1`);
}
