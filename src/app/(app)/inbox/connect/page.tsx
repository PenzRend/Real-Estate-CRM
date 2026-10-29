import type { Metadata } from "next";
import { ImapConnectForm } from "@/components/mail/imap-connect-form";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";

export const metadata: Metadata = { title: "Postafiók összekapcsolása" };

async function ConnectContent({ searchParams }: Pick<PageProps<"/inbox/connect">, "searchParams">) {
  const { email } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Levelek" description="Céges, iCloud vagy más postafiók összekapcsolása." />
      <ImapConnectForm email={typeof email === "string" ? email : undefined} cancelHref="/inbox" />
    </div>
  );
}

export default function ConnectMailboxPage({ searchParams }: PageProps<"/inbox/connect">) {
  return (
    <PageSuspense>
      <ConnectContent searchParams={searchParams} />
    </PageSuspense>
  );
}
