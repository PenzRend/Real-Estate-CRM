// Chat text: @mentions. Pure, so it is tested; used by the chat (to show
// mentions as names) and by the notification job (to know whom to tell).

const MENTION = /(^|[^\w@.])@([a-z0-9._]{3,30})/g;

/** The usernames mentioned in a message, each once ("@kata" → "kata"). */
export function mentionedUsernames(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.toLowerCase().matchAll(MENTION)) out.add(m[2].replace(/\.+$/, ""));
  return [...out];
}

export type TextPart = { text: string; mention?: string };

/** A message cut into plain text and @mentions, for showing mentions highlighted. */
export function splitMentions(body: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION)) {
    const name = m[2].toLowerCase().replace(/\.+$/, "");
    const start = (m.index ?? 0) + m[1].length;
    const end = start + 1 + name.length;
    if (start > last) parts.push({ text: body.slice(last, start) });
    parts.push({ text: body.slice(start, end), mention: name });
    last = end;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

/** The "@ab" being typed at the cursor, for suggestions; null when the cursor isn't in a mention. */
export function mentionAtCursor(text: string, cursor: number): { query: string; start: number } | null {
  const m = /(^|[\s(])@([a-z0-9._]{0,30})$/i.exec(text.slice(0, cursor));
  return m ? { query: m[2].toLowerCase(), start: cursor - m[2].length - 1 } : null;
}
