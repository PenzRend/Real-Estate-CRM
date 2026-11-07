"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { AVATARS_BUCKET, USERNAME } from "@/lib/avatar";
import { authErrorMessage, newPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { ok?: boolean; error?: string; message?: string };

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Add meg a neved.").max(200, "Legfeljebb 200 karakter."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME, "A felhasználónév 3–30 karakter: kisbetű, szám, pont vagy aláhúzás."),
  workspace_name: z.string().trim().min(1, "Add meg a munkaterület nevét.").max(200, "Legfeljebb 200 karakter.").optional(),
});

/** Name and, for owners and admins, the workspace name. */
export async function saveProfileAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  const canRename = user.organization.role !== "member";
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    username: String(formData.get("username") ?? "").replace(/^@/, ""),
    workspace_name: canRename ? formData.get("workspace_name") : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (parsed.data.username !== user.username) {
    const { data: free } = await supabase.rpc("username_available", { p_username: parsed.data.username });
    if (!free) return { error: `A @${parsed.data.username} felhasználónév már foglalt. Válassz másikat.` };
  }
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.full_name, username: parsed.data.username }).eq("id", user.id);
  if (error) return { error: error.code === "23505" ? "Ez a felhasználónév már foglalt." : "A mentés nem sikerült. Próbáld újra." };
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

/** Whether a username is free, while it is being typed. */
export async function usernameAvailableAction(username: string) {
  const user = await getCurrentUser();
  const u = String(username).trim().toLowerCase().replace(/^@/, "");
  if (u === user.username) return true;
  if (!USERNAME.test(u)) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("username_available", { p_username: u });
  return Boolean(data);
}

/** A picture the browser uploaded into the user's avatars folder; the previous one is removed. */
export async function saveAvatarAction(path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const p = String(path);
  if (!p.startsWith(`${user.id}/`) || p.includes("..") || p.length > 300) return { ok: false, error: "Érvénytelen kép." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: p }).eq("id", user.id);
  if (error) return { ok: false, error: "A képet nem sikerült menteni." };
  if (before?.avatar_path && before.avatar_path !== p) await supabase.storage.from(AVATARS_BUCKET).remove([before.avatar_path]);
  refresh();
  return { ok: true };
}

export async function removeAvatarAction() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (before?.avatar_path) await supabase.storage.from(AVATARS_BUCKET).remove([before.avatar_path]);
  refresh();
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
