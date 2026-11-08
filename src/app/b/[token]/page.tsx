import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking/booking-form";
import { bookingPage } from "@/lib/booking/data";
import { freeSlots } from "@/lib/booking/slots";

// An agent's viewing booking page: no sign-in, no CRM chrome; the free
// times and the office's active listings only. Not indexed.

export const metadata: Metadata = { title: { absolute: "Megtekintés foglalása" }, robots: { index: false, follow: false } };

async function Booking({ params, searchParams }: PageProps<"/b/[token]">) {
  await connection();
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const page = await bookingPage(token);
  if (!page) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center">
        <h1 className="text-2xl">Ez a foglalási link már nem él</h1>
        <p className="text-muted">Keresd az ingatlanost telefonon vagy e-mailben.</p>
      </div>
    );
  }
  const days = freeSlots(page, page.busy, new Date());
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm text-muted">{page.agency}</p>
        <h1 className="mt-1 text-[30px] leading-tight sm:text-[36px]">Megtekintés foglalása</h1>
        <p className="mt-2 text-muted">
          Válassz időpontot {page.agent} naptárából – {page.slotMinutes} perc, a helyszínen találkoztok.
        </p>
      </header>
      <BookingForm token={token} listings={page.listings} days={days} initialListing={typeof query.p === "string" ? query.p : null} agent={page.agent} />
    </div>
  );
}

export default function BookingPage(props: PageProps<"/b/[token]">) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-background px-5 py-10 sm:py-16">
      <Suspense fallback={<div className="h-96 shimmer rounded-3xl bg-surface" />}>
        <Booking {...props} />
      </Suspense>
    </main>
  );
}
