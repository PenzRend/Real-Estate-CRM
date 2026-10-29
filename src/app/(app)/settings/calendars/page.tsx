import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarConnections } from "@/components/calendar/connections";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Naptárak" };

async function CalendarsContent() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-6">
      <Link href="/settings" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Beállítások
      </Link>
      <PageHeader title="Naptárak" description="A saját naptáraid a Flavio Naptárában, és a megtekintések a telefonod és a többi naptárad között." />
      <CalendarConnections user={user} returnTo="/settings/calendars" />
      <Link href="/calendar" className="w-fit text-sm font-medium text-ink underline-offset-2 hover:underline">
        Ugrás a Naptárra →
      </Link>
    </div>
  );
}

export default function CalendarSettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CalendarsContent />
    </Suspense>
  );
}
