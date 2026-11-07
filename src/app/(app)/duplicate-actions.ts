"use server";

import { getCurrentUser } from "@/lib/auth";
import { clientDuplicates, propertyDuplicates } from "@/lib/duplicates";

const str = (v: unknown) => String(v ?? "").slice(0, 300);

export async function clientDuplicatesAction(input: { name?: string; phone?: string; email?: string }, excludeId?: string | null) {
  const user = await getCurrentUser();
  return clientDuplicates(user, { name: str(input.name), phone: str(input.phone), email: str(input.email) }, excludeId ? str(excludeId) : null);
}

export async function propertyDuplicatesAction(input: { address?: string; city?: string; sourceUrl?: string }, excludeId?: string | null) {
  const user = await getCurrentUser();
  return propertyDuplicates(user, { address: str(input.address), city: str(input.city), sourceUrl: str(input.sourceUrl) }, excludeId ? str(excludeId) : null);
}
