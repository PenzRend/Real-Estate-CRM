"use server";

import { redirect } from "next/navigation";
import { saveIdentification } from "@/lib/aml/data";
import { getCurrentUser } from "@/lib/auth";
import { AiError } from "@/lib/ai/extract";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { readIdDocument } from "@/lib/aml/scan";
import type { ScannedFields } from "@/lib/aml/scan-fields";
import { createClient } from "@/lib/supabase/server";

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

export type ScanResult = { ok: true; fields: ScannedFields } | { ok: false; error: string };

// A phone photo, shrunk in the browser to about 1600 px: well under this.
const MAX_IMAGE = 3_000_000;

/** Reads an ID document or an address card from one or two photos and returns the form fields it found. The photos are not stored. */
export async function scanIdDocumentAction(clientId: string, kind: unknown, images: unknown): Promise<ScanResult> {
  const user = await getCurrentUser();
  if (kind !== "identity" && kind !== "address") return { ok: false, error: "Ismeretlen okmány." };
  if (!Array.isArray(images) || !images.length || images.length > 2 || !images.every((i) => typeof i === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(i) && i.length <= MAX_IMAGE)) {
    return { ok: false, error: "Egy vagy két fotót tölts fel (JPG vagy PNG)." };
  }
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).eq("organization_id", user.organization.id).maybeSingle();
  if (!client) return { ok: false, error: "Az ügyfél nem található." };
  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };
  try {
    const r = await readIdDocument(kind, images as string[]);
    await logAiUsage(user, { status: "success", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    if (!Object.keys(r.fields).length) return { ok: false, error: "Nem találtam olvasható adatot. Készíts élesebb, egyenes fotót jó fényben, vagy töltsd ki kézzel." };
    return { ok: true, fields: r.fields };
  } catch (error) {
    await logAiUsage(user, { status: "error" });
    if (error instanceof AiError) return { ok: false, error: error.userMessage };
    console.error("id scan", error instanceof Error ? error.message : error);
    return { ok: false, error: "Az okmányt most nem sikerült beolvasni. Próbáld újra, vagy töltsd ki kézzel." };
  }
}
