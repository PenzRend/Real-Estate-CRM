import type { Metadata } from "next";
import { connection } from "next/server";
import { ChatView } from "@/components/chat/chat-view";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { isPeer, listConversations, listMessages, markRead } from "@/lib/chat/data";

export const metadata: Metadata = { title: "Üzenetek" };

async function Messages({ searchParams }: Pick<PageProps<"/messages">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const user = await getCurrentUser();
  // No ?with: the conversation list on a phone, the office channel beside it on a wide screen.
  const asked = typeof params.with === "string" && isPeer(params.with) && params.with !== user.id ? params.with : "list";
  const open = asked === "list" ? "office" : asked;
  await markRead(user, open);
  const [{ conversations, members }, messages] = await Promise.all([listConversations(user), listMessages(user, open)]);
  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader title="Üzenetek" description="Beszélgetés az irodával vagy egy kollégával – gyorsan, a Flavión belül." />
      <ChatView key={open} me={user.id} peer={asked} conversations={conversations} members={members} initial={messages} />
    </div>
  );
}

export default function MessagesPage({ searchParams }: PageProps<"/messages">) {
  return (
    <PageSuspense>
      <Messages searchParams={searchParams} />
    </PageSuspense>
  );
}
