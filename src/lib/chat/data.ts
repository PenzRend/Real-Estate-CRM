import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/team";

// Üzenetek: the office channel ("office") and one-to-one conversations (the
// other member's id). Reading goes through the user's session, so RLS shows
// only the office channel and their own direct messages.

export type ChatMessage = { id: string; senderId: string; recipientId: string | null; body: string; createdAt: string };
export type Conversation = { peer: string; name: string; unread: number; last: { body: string; at: string; mine: boolean } | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 100;

export const isPeer = (peer: string) => peer === "office" || UUID.test(peer);

/** The office channel first, then each colleague (most recent conversation first). */
export async function listConversations(user: CurrentUser): Promise<{ conversations: Conversation[]; members: { userId: string; name: string }[] }> {
  const supabase = await createClient();
  const [{ members }, unread, recent] = await Promise.all([
    listTeam(user),
    supabase.rpc("chat_unread", { p_org: user.organization.id }),
    supabase
      .from("chat_messages")
      .select("sender_id, recipient_id, body, created_at")
      .eq("organization_id", user.organization.id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const unreadBy = new Map(((unread.data ?? []) as { peer: string; unread: number }[]).map((u) => [u.peer, Number(u.unread)]));
  const lastBy = new Map<string, Conversation["last"]>();
  for (const m of recent.data ?? []) {
    const peer = m.recipient_id == null ? "office" : m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (!lastBy.has(peer)) lastBy.set(peer, { body: m.body, at: m.created_at, mine: m.sender_id === user.id });
  }
  const others = members.filter((m) => m.userId !== user.id);
  const direct = others
    .map((m) => ({ peer: m.userId, name: m.name, unread: unreadBy.get(m.userId) ?? 0, last: lastBy.get(m.userId) ?? null }))
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? "") || a.name.localeCompare(b.name, "hu"));
  return {
    conversations: [{ peer: "office", name: user.organization.name, unread: unreadBy.get("office") ?? 0, last: lastBy.get("office") ?? null }, ...direct],
    members: members.map((m) => ({ userId: m.userId, name: m.name })),
  };
}

/** The latest messages of one conversation, oldest first. */
export async function listMessages(user: CurrentUser, peer: string): Promise<ChatMessage[]> {
  if (!isPeer(peer)) return [];
  const supabase = await createClient();
  let q = supabase.from("chat_messages").select("id, sender_id, recipient_id, body, created_at").eq("organization_id", user.organization.id);
  q =
    peer === "office"
      ? q.is("recipient_id", null)
      : q.or(`and(sender_id.eq.${user.id},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${user.id})`);
  const { data } = await q.order("created_at", { ascending: false }).limit(PAGE);
  return (data ?? [])
    .map((m) => ({ id: m.id, senderId: m.sender_id, recipientId: m.recipient_id, body: m.body, createdAt: m.created_at }))
    .reverse();
}

export async function sendMessage(user: CurrentUser, peer: string, body: string): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
  const text = body.trim().slice(0, 4000);
  if (!text || !isPeer(peer) || peer === user.id) return { ok: false, error: "Üres üzenet." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ organization_id: user.organization.id, recipient_id: peer === "office" ? null : peer, body: text })
    .select("id, sender_id, recipient_id, body, created_at")
    .single();
  if (error || !data) {
    console.error("chat send failed", error?.code);
    return { ok: false, error: "Az üzenet nem ment el. Próbáld újra." };
  }
  await markRead(user, peer);
  return { ok: true, message: { id: data.id, senderId: data.sender_id, recipientId: data.recipient_id, body: data.body, createdAt: data.created_at } };
}

export async function deleteMessage(user: CurrentUser, id: string) {
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("chat_messages").delete().eq("id", id).eq("sender_id", user.id);
}

export async function markRead(user: CurrentUser, peer: string) {
  if (!isPeer(peer)) return;
  const supabase = await createClient();
  await supabase
    .from("chat_reads")
    .upsert({ user_id: user.id, organization_id: user.organization.id, peer, last_read_at: new Date().toISOString() }, { onConflict: "user_id,organization_id,peer" });
}

/** All unread messages, for the badge in the menu. */
export async function unreadTotal(user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_unread", { p_org: user.organization.id });
  return ((data ?? []) as { unread: number }[]).reduce((s, u) => s + Number(u.unread), 0);
}
