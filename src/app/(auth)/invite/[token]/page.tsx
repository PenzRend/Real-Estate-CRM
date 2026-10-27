import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { JoinForm } from "@/components/auth/join-form";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { invitationPreview } from "@/lib/team";

export const metadata: Metadata = { title: "Meghívó" };

const closed: Record<string, string> = {
  accepted: "Ezt a meghívót már felhasználták.",
  revoked: "Ezt a meghívót visszavonták.",
  expired: "Ez a meghívó lejárt.",
};

async function Invite({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  // The session check compares token expiry with the clock: request time only.
  await connection();
  const supabase = await createClient();
  const [invite, { data: auth }] = await Promise.all([/^[\w-]{20,100}$/.test(token) ? invitationPreview(token) : null, supabase.auth.getClaims()]);
  const here = `/invite/${token}`;

  if (!invite || invite.status !== "open") {
    return (
      <>
        <h1 className="text-[32px] leading-tight">A meghívó nem érvényes</h1>
        <p className="mt-2 text-muted">
          {invite ? closed[invite.status] : "Ez a link nem létezik."} Kérj új linket attól, aki meghívott.
        </p>
        <ButtonLink href={auth?.claims ? "/dashboard" : "/login"} variant="secondary" className="mt-8">
          {auth?.claims ? "Tovább a Flavióba" : "Bejelentkezés"}
        </ButtonLink>
      </>
    );
  }

  const heading = (
    <>
      <h1 className="text-[32px] leading-tight">Csatlakozz a csapathoz</h1>
      <p className="mt-2 text-muted">
        {invite.invited_by_name ?? "Egy kollégád"} meghívott a(z) <span className="font-medium text-ink">{invite.organization_name}</span> munkaterületre. Közösen látjátok az ügyfeleket, ingatlanokat és feladatokat.
      </p>
    </>
  );

  const signedInAs = typeof auth?.claims?.email === "string" ? auth.claims.email.toLowerCase() : null;
  if (auth?.claims && signedInAs === invite.email) {
    return (
      <>
        {heading}
        <JoinForm token={token} workspace={invite.organization_name} />
      </>
    );
  }

  if (auth?.claims) {
    return (
      <>
        {heading}
        <p className="mt-6 rounded-xl bg-surface px-3.5 py-3 text-sm text-text">
          A meghívó a(z) <span className="font-medium text-ink">{invite.email}</span> címre szól, de most {signedInAs ?? "egy másik fiókkal"} vagy bejelentkezve. Jelentkezz ki, és lépj be a meghívott címmel.
        </p>
        <form action={`/auth/signout?next=${encodeURIComponent(here)}`} method="post" className="mt-8">
          <button type="submit" className={buttonClasses("primary", "lg", "w-full")}>
            Kijelentkezés
          </button>
        </form>
      </>
    );
  }

  const query = (extra: Record<string, string>) => new URLSearchParams({ next: here, ...extra }).toString();
  return (
    <>
      {heading}
      <p className="mt-6 text-sm text-muted">
        A meghívó a(z) <span className="font-medium text-ink">{invite.email}</span> címre szól.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <ButtonLink href={`/signup?${query({ email: invite.email })}`} size="lg" className="w-full">
          Fiók létrehozása
        </ButtonLink>
        <ButtonLink href={`/login?${query({})}`} size="lg" variant="secondary" className="w-full">
          Már van fiókom
        </ButtonLink>
      </div>
      <p className="mt-8 text-xs text-muted">
        A Flavio ingatlanosoknak készült CRM. <Link href="/" className="underline-offset-4 hover:underline">Bővebben</Link>
      </p>
    </>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface" />}>
      <Invite params={params} />
    </Suspense>
  );
}
