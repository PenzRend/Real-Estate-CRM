"use server";

import { z } from "zod";
import { bookPublic } from "@/lib/booking/data";

const input = z.object({
  propertyId: z.string().uuid(),
  start: z.string().datetime(),
  name: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(50),
  email: z.string().trim().max(320),
  note: z.string().trim().max(1000),
});

/** A visitor books a viewing on an agent's booking page (no sign-in; the database checks the slot again). */
export async function bookViewingPublicAction(token: string, raw: unknown) {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Add meg a neved, és válassz időpontot." };
  return bookPublic(String(token), parsed.data);
}
