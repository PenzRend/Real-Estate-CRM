import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Regisztráció" };

// URL data is read behind Suspense so the rest of the page stays in the static shell.
async function SignupFormFromUrl({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const email = typeof params.email === "string" ? params.email.slice(0, 320) : undefined;
  return <SignupForm next={next} email={email} />;
}

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <>
      <h1 className="text-[32px] leading-tight">Fiók létrehozása</h1>
      <p className="mt-2 text-muted">Saját munkaterületet kapsz, amit később meg is oszthatsz az irodáddal.</p>

      <Suspense fallback={<SignupForm />}>
        <SignupFormFromUrl searchParams={searchParams} />
      </Suspense>

      <p className="mt-8 text-sm text-muted">
        Van már fiókod?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Bejelentkezés
        </Link>
      </p>
    </>
  );
}
