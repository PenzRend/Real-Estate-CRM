"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  kind: z.enum(["bug", "idea", "other"]),
  message: z.string().trim().min(1, "Írd le röviden, mit szeretnél jelezni.").max(5000, "Legfeljebb 5000 karakter."),
  page: z.string().max(500).nullable(),
});

export type FeedbackResult = { ok: true } | { ok: false; error: string };

/** "Visszajelzés": saved for the product team with the page it was sent from. */
export async function sendFeedbackAction(input: unknown): Promise<FeedbackResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Hiányos adatok." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("product_feedback").insert({
    organization_id: user.organization.id,
    user_id: user.id,
    kind: parsed.data.kind,
    message: parsed.data.message,
    page: parsed.data.page,
    user_agent: (await headers()).get("user-agent")?.slice(0, 500) ?? null,
  });
  if (error) {
    console.error("feedback insert failed", error.code);
    return { ok: false, error: "A küldés nem sikerült. Próbáld újra." };
  }
  return { ok: true };
}
