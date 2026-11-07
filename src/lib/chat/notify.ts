import { mentionedIds, plainText } from "./text";

// Who gets a phone notification about a chat message: the addressee of a
// direct message, and everyone @mentioned in the office channel (who is a
// member) – never the sender. Office messages without mentions notify no one
// (too noisy). Pure, so it is tested; the cron job (lib/cron/jobs.ts) sends them.

export type ChatNotice = { userId: string; reason: "direct" | "mention" };

export function chatRecipients(m: { senderId: string; recipientId: string | null; body: string }, memberIds: Set<string>): ChatNotice[] {
  // A direct message only ever tells its addressee: no one else can read it.
  if (m.recipientId) return m.recipientId === m.senderId ? [] : [{ userId: m.recipientId, reason: "direct" }];
  return mentionedIds(m.body)
    .filter((id) => memberIds.has(id) && id !== m.senderId)
    .map((userId) => ({ userId, reason: "mention" as const }));
}

const refLabels: Record<string, string> = { client: "egy ügyfelet", property: "egy ingatlant", deal: "egy ügyletet" };

/** The notification's text; mentions are written with the members' names. */
export function chatNoticeText(n: ChatNotice, sender: string, m: { body: string; refKind: string | null; recipientId: string | null }, nameOf: (id: string) => string | undefined) {
  const what = plainText(m.body, nameOf).trim() || `Megosztott ${refLabels[m.refKind ?? ""] ?? "valamit"}.`;
  return {
    title: n.reason === "mention" && !m.recipientId ? `${sender} megemlített az irodai csevegésben` : sender,
    body: what.length > 200 ? `${what.slice(0, 197)}…` : what,
  };
}
