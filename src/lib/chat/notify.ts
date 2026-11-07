import { mentionedUsernames } from "./text";

// Who gets a phone notification about a chat message: the addressee of a
// direct message, and everyone @mentioned in the office channel (who is a
// member) – never the sender. Office messages without mentions notify no one
// (too noisy). Pure, so it is tested; the cron job (lib/cron/jobs.ts) sends them.

export type ChatNotice = { userId: string; reason: "direct" | "mention" };

export function chatRecipients(
  m: { senderId: string; recipientId: string | null; body: string },
  memberByUsername: Map<string, string>,
): ChatNotice[] {
  const out = new Map<string, ChatNotice>();
  // A direct message only ever tells its addressee: no one else can read it.
  if (m.recipientId) return m.recipientId === m.senderId ? [] : [{ userId: m.recipientId, reason: "direct" }];
  for (const u of mentionedUsernames(m.body)) {
    const id = memberByUsername.get(u);
    if (id && id !== m.senderId && !out.has(id)) out.set(id, { userId: id, reason: "mention" });
  }
  return [...out.values()];
}

const refLabels: Record<string, string> = { client: "egy ügyfelet", property: "egy ingatlant", deal: "egy ügyletet" };

/** The notification's text. */
export function chatNoticeText(n: ChatNotice, sender: string, m: { body: string; refKind: string | null; recipientId: string | null }) {
  const what = m.body.trim() || `Megosztott ${refLabels[m.refKind ?? ""] ?? "valamit"}.`;
  return {
    title: n.reason === "mention" && !m.recipientId ? `${sender} megemlített az irodai csevegésben` : sender,
    body: what.length > 200 ? `${what.slice(0, 197)}…` : what,
  };
}
