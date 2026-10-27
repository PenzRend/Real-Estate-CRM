"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ensureShare, revokeShare, updateShare, type Share } from "@/lib/shares/data";
import { clientContactFields } from "@/lib/validation/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The contact shown on the client-facing page: same rules as client contacts.
const settingsSchema = z.object({
  showAddress: z.boolean(),
  contactName: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(200).nullable()),
  contactPhone: clientContactFields.phone,
  contactEmail: clientContactFields.email,
});

export type ShareResult = { ok: true; share: Share | null } | { ok: false; errors: Partial<Record<"contactPhone" | "contactEmail", string>> };

function parse(input: unknown) {
  const parsed = settingsSchema.safeParse(input);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const errors: Partial<Record<"contactPhone" | "contactEmail", string>> = {};
  for (const i of parsed.error.issues) {
    const k = i.path[0];
    if ((k === "contactPhone" || k === "contactEmail") && !errors[k]) errors[k] = i.message;
  }
  return { ok: false as const, errors };
}

export async function createShareAction(propertyId: string, input: unknown): Promise<ShareResult> {
  if (!UUID.test(propertyId)) throw new Error("Invalid property id");
  const user = await getCurrentUser();
  const p = parse(input);
  if (!p.ok) return p;
  const share = await ensureShare(user, propertyId, p.data);
  refresh();
  return { ok: true, share };
}

export async function updateShareAction(propertyId: string, input: unknown): Promise<ShareResult> {
  if (!UUID.test(propertyId)) throw new Error("Invalid property id");
  const user = await getCurrentUser();
  const p = parse(input);
  if (!p.ok) return p;
  await updateShare(user, propertyId, p.data);
  refresh();
  return { ok: true, share: null };
}

export async function revokeShareAction(propertyId: string) {
  if (!UUID.test(propertyId)) throw new Error("Invalid property id");
  const user = await getCurrentUser();
  await revokeShare(user, propertyId);
  refresh();
}
