import { z } from "zod";

export const newPassword = z
  .string()
  .min(8, "A jelszó legalább 8 karakter legyen.")
  .max(72, "A jelszó legfeljebb 72 karakter lehet.");

const supabaseErrors: Record<string, string> = {
  invalid_credentials: "Hibás e-mail-cím vagy jelszó.",
  email_not_confirmed: "Előbb erősítsd meg az e-mail-címedet a neked küldött levélben található linkkel.",
  user_already_exists: "Ezzel az e-mail-címmel már van fiók. Jelentkezz be, vagy kérj új jelszót.",
  weak_password: "Ez a jelszó túl gyenge. Válassz hosszabbat, kevésbé kitalálhatót.",
  same_password: "Az új jelszó nem egyezhet meg a régivel.",
  reauthentication_needed: "Biztonsági okból jelentkezz ki és be újra, majd próbáld újra.",
  over_email_send_rate_limit: "Túl sok e-mail ment ki rövid idő alatt. Próbáld újra néhány perc múlva.",
  over_request_rate_limit: "Túl sok próbálkozás. Próbáld újra néhány perc múlva.",
};

/** Supabase Auth error → Hungarian message; unknown codes get a generic one. */
export function authErrorMessage(error: { code?: string; message: string }) {
  return (error.code && supabaseErrors[error.code]) || "Valami hiba történt. Próbáld újra később.";
}
