"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { authErrorMessage, newPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { ok?: boolean; error?: string; message?: string };

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Add meg a neved.").max(200, "Legfeljebb 200 karakter."),
  workspace_name: z.string().trim().min(1, "Add meg a munkaterület nevét.").max(200, "Legfeljebb 200 karakter.").optional(),
});

/** Name and, for owners and admins, the workspace name. */
export async function saveProfileAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  const canRename = user.organization.role !== "member";
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    workspace_name: canRename ? formData.get("workspace_name") : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.full_name }).eq("id", user.id);
  if (error) return { error: "A mentés nem sikerült. Próbáld újra." };
  if (parsed.data.workspace_name && parsed.data.workspace_name !== user.organization.name) {
    const { error: orgError } = await supabase
      .from("organizations")
      .update({ name: parsed.data.workspace_name })
      .eq("id", user.organization.id);
    if (orgError) return { error: "A munkaterület nevét nem sikerült menteni. Próbáld újra." };
  }

  refresh();
  return { ok: true, message: "Elmentve." };
}

export async function changePasswordAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await getCurrentUser();
  const parsed = z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "A két jelszó nem egyezik." })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };
  return { ok: true, message: "A jelszavad megváltozott." };
}
