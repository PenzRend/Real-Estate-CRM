import type { MailProvider } from "@/lib/mail/provider";
// Pure rules behind "Mi történt, amíg távol voltál": the away window, who a
// reply goes to, which listing an email is about, and the compose link (Gmail or Outlook).

/** Gaps shorter than this count as the same working session. */
export const SESSION_GAP_MS = 30 * 60_000;
const FIRST_VISIT_WINDOW_MS = 24 * 3600_000;

export type Visit = { lastSeenAt: string; previousSeenAt: string | null };

/**
 * Start of the away window. A new session (long gap since the last visit)
 * starts from that visit; within a session the window stays where it was,
 * so the summary doesn't vanish while the agent works through it.
 */
export function awaySince(visit: Visit | null, now: Date): Date {
  if (!visit) return new Date(now.getTime() - FIRST_VISIT_WINDOW_MS);
  const last = new Date(visit.lastSeenAt);
  if (now.getTime() - last.getTime() > SESSION_GAP_MS) return last;
  return visit.previousSeenAt ? new Date(visit.previousSeenAt) : new Date(now.getTime() - FIRST_VISIT_WINDOW_MS);
}

/** The visit row to store after this visit; consistent with awaySince. */
export function nextVisit(visit: Visit | null, now: Date): Visit {
  // The first session's window (the last 24 hours) is stored, so it doesn't drift on reload.
  if (!visit) return { lastSeenAt: now.toISOString(), previousSeenAt: new Date(now.getTime() - FIRST_VISIT_WINDOW_MS).toISOString() };
  const newSession = now.getTime() - new Date(visit.lastSeenAt).getTime() > SESSION_GAP_MS;
  return { lastSeenAt: now.toISOString(), previousSeenAt: newSession ? visit.lastSeenAt : visit.previousSeenAt };
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const AUTOMATED = /noreply|no-reply|donotreply|mailer-daemon|notification|ertesito|értesítő/i;

/**
 * Who a reply should go to: Reply-To, then the linked client, then a human
 * sender, then the one address written in a portal email's text. Null when
 * it isn't clear; the agent fills it in.
 */
export function replyRecipient(e: {
  replyTo: string | null;
  fromEmail: string | null;
  portal: string | null;
  clientEmail: string | null;
  body: string | null;
  mailboxEmail: string | null;
  portalDomains: string[];
}): string | null {
  const own = e.mailboxEmail?.toLowerCase();
  const usable = (a: string | null | undefined) => {
    const v = a?.trim().toLowerCase();
    if (!v || v === own || AUTOMATED.test(v)) return null;
    if (e.portalDomains.some((d) => v.endsWith(`@${d}`) || v.endsWith(`.${d}`))) return null;
    return v;
  };
  const direct = usable(e.replyTo) ?? usable(e.clientEmail) ?? (e.portal ? null : usable(e.fromEmail));
  if (direct) return direct;
  const inText = [...new Set((e.body?.match(EMAIL) ?? []).map((a) => usable(a)).filter(Boolean))] as string[];
  return inText.length === 1 ? inText[0] : null;
}

/** A listing named in the text by reference number or exact title. */
export function findMentionedProperty<P extends { name: string; reference?: string | null }>(text: string, properties: P[]): P | undefined {
  const t = text.toLowerCase();
  return properties.find((p) => (p.reference && t.includes(p.reference.toLowerCase())) || (p.name.length >= 8 && t.includes(p.name.toLowerCase())));
}

export function replySubject(subject: string | null) {
  const s = (subject ?? "").trim();
  if (!s) return "Válasz";
  return /^(re|vá|válasz)\s*:/i.test(s) ? s : `Re: ${s}`;
}

/** Opens Gmail's compose window, prefilled, in the connected account. Nothing is sent. */
export function composeUrl(provider: MailProvider, d: { account: string | null; to: string | null; subject: string; body: string }) {
  if (provider === "outlook") {
    const p = new URLSearchParams({ subject: d.subject, body: d.body });
    if (d.to) p.set("to", d.to);
    return `https://outlook.office.com/mail/deeplink/compose?${p.toString()}`;
  }
  const p = new URLSearchParams({ view: "cm", fs: "1", su: d.subject, body: d.body });
  if (d.to) p.set("to", d.to);
  if (d.account) p.set("authuser", d.account);
  return `https://mail.google.com/mail/?${p.toString()}`;
}

/** One plain sentence about what came in; null when nothing did. */
export function awayHeadline(c: { inquiries: number; clientEmails: number; otherEmails: number; tasksDue: number }) {
  const parts: string[] = [];
  if (c.inquiries) parts.push(`${c.inquiries} új érdeklődés`);
  if (c.clientEmails) parts.push(`${c.clientEmails} levél ügyféltől`);
  if (c.otherEmails) parts.push(`${c.otherEmails} egyéb levél`);
  if (c.tasksDue) parts.push(`${c.tasksDue} teendő lett esedékes`);
  if (!parts.length) return null;
  const last = parts.pop()!;
  return `${parts.length ? `${parts.join(", ")} és ${last}` : last}.`.replace(/^./, (ch) => ch.toUpperCase());
}
