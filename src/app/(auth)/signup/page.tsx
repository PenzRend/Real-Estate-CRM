import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Regisztráció" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-[32px] leading-tight">Fiók létrehozása</h1>
      <p className="mt-2 text-muted">Saját munkaterületet kapsz, amit később meg is oszthatsz az irodáddal.</p>

      <SignupForm />

      <p className="mt-8 text-sm text-muted">
        Van már fiókod?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Bejelentkezés
        </Link>
      </p>
    </>
  );
}
