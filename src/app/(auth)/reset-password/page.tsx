import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Új jelszó" };

// Reached from the recovery email via /auth/confirm, which signs the user in;
// the proxy sends anyone without a session to /login.
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-[32px] leading-tight">Új jelszó beállítása</h1>
      <p className="mt-2 text-muted">Válassz egy új jelszót a fiókodhoz.</p>
      <ResetPasswordForm />
    </>
  );
}
