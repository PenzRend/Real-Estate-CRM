"use server";

import { getCurrentUser } from "@/lib/auth";
import { deleteMessage, listMessages, markRead, sendMessage, unreadTotal } from "@/lib/chat/data";
import { globalSearch } from "@/lib/search/global";
import { listTeam } from "@/lib/team";

export async function sendMessageAction(peer: string, body: string) {
  const user = await getCurrentUser();
  return sendMessage(user, String(peer), String(body));
}

export async function deleteMessageAction(id: string) {
  const user = await getCurrentUser();
  await deleteMessage(user, String(id));
}

export async function markReadAction(peer: string) {
  const user = await getCurrentUser();
  await markRead(user, String(peer));
}

/** The latest messages, when the live connection reports something new. */
export async function loadMessagesAction(peer: string) {
  const user = await getCurrentUser();
  return listMessages(user, String(peer));
}

export async function unreadTotalAction() {
  const user = await getCurrentUser();
  return unreadTotal(user);
}

/** Shares a client, listing or deal into a conversation, with an optional note. */
export async function shareToChatAction(peer: string, ref: { kind: string; id: string }, note: string) {
  const user = await getCurrentUser();
  return sendMessage(user, String(peer), String(note ?? ""), { kind: String(ref?.kind), id: String(ref?.id) });
}

/** Clients, listings and deals matching a search, to attach to a message. */
export async function searchShareableAction(query: string) {
  const user = await getCurrentUser();
  const hits = await globalSearch(user, String(query ?? "").slice(0, 200));
  const kinds = { clients: "client", properties: "property", deals: "deal" } as const;
  return hits.flatMap((h) => (h.group in kinds ? [{ kind: kinds[h.group as keyof typeof kinds], id: h.id, title: h.title, detail: h.detail }] : []));
}

/** Who a record can be sent to: the office channel and each colleague. */
export async function chatTargetsAction() {
  const user = await getCurrentUser();
  const { members } = await listTeam(user);
  return {
    office: user.organization.name,
    colleagues: members.filter((m) => m.userId !== user.id).map((m) => ({ userId: m.userId, name: m.name, username: m.username, avatarUrl: m.avatarUrl })),
  };
}
