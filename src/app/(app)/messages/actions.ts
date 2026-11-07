"use server";

import { getCurrentUser } from "@/lib/auth";
import { deleteMessage, listMessages, markRead, sendMessage, unreadTotal } from "@/lib/chat/data";

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
