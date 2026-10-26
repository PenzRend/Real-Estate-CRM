import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Bejelentkezés" };

const notices: Record<string, string> = {
  link: "A link lejárt vagy már felhasználták. Jelentkezz be, vagy kérj új linket.",
  profile: "A fiókodhoz nem található munkaterület. Jelentkezz be újra; ha a hiba megmarad, szólj nekünk.",
};

// URL data is read behind Suspense so the rest of the page stays in the static shell.
async function LoginFormFromUrl({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice = typeof params.error === "string" ? notices[params.error] : undefined;
  return <LoginForm next={next} notice={notice} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-[32px] leading-tight">Üdv újra</h1>
      <p className="mt-2 text-muted">Jelentkezz be a munkaterületedre.</p>

      <Suspense fallback={<LoginForm />}>
        <LoginFormFromUrl searchParams={searchParams} />
      </Suspense>

      <p className="mt-8 text-sm text-muted">
        Még nincs fiókod?{" "}
        <Link href="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
          Regisztráció
        </Link>
      </p>
    </>
  );
}
