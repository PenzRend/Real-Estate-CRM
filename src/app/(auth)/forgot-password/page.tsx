import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Elfelejtett jelszó" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[32px] leading-tight">Új jelszó kérése</h1>
      <p className="mt-2 text-muted">Küldünk egy linket, amellyel új jelszót állíthatsz be.</p>

      <ForgotPasswordForm />

      <p className="mt-8 text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          ← Vissza a bejelentkezéshez
        </Link>
      </p>
    </>
  );
}
