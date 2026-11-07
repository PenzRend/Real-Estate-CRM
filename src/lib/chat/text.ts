// Chat text and @mentions, the way Slack does them: you type "@" and pick a
// colleague by name, the message keeps who was meant ("<@user-id>"), and it
// is always shown with their current name. Pure, so it is tested; used by the
// chat (to write and show mentions) and the notification job (whom to tell).

const TOKEN = /<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/gi;

/** The members mentioned in a message, each once. */
export function mentionedIds(body: string): string[] {
  return [...new Set([...body.matchAll(TOKEN)].map((m) => m[1].toLowerCase()))];
}

export type TextPart = { text: string; mention?: string };

/** A message cut into plain text and mentions (the mentioned member's id). */
export function splitMentions(body: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: body.slice(last, start) });
    parts.push({ text: m[0], mention: m[1].toLowerCase() });
    last = start + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

/** The message as plain text, mentions written as "@Name" (previews, notifications). */
export function plainText(body: string, nameOf: (id: string) => string | undefined) {
  return body.replace(TOKEN, (_, id: string) => `@${nameOf(id.toLowerCase()) ?? "kolléga"}`);
}

/** Before sending: each "@Name" picked from the suggestions becomes that member's token. */
export function encodeMentions(text: string, picked: { id: string; name: string }[]) {
  let out = text;
  // Longest names first, so "@Kovács Anna Mária" isn't cut at "@Kovács Anna".
  for (const p of [...picked].sort((a, b) => b.name.length - a.name.length)) out = out.split(`@${p.name}`).join(`<@${p.id}>`);
  return out;
}

/** The "@Ann" being typed at the cursor (names have spaces), for suggestions; null when not in a mention. */
export function mentionAtCursor(text: string, cursor: number): { query: string; start: number } | null {
  const m = /(^|[\s(])@([\p{L}\p{N}.' -]{0,30})$/u.exec(text.slice(0, cursor));
  if (!m || /\s{2}|^\s/.test(m[2])) return null;
  return { query: m[2].toLowerCase(), start: cursor - m[2].length - 1 };
}
