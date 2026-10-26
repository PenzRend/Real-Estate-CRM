// Reading Gmail API message payloads: addresses, plain-text body, metadata.

export type Address = { name: string | null; email: string };

/** "Kovács Anna <anna@example.hu>" → { name: "Kovács Anna", email: "anna@example.hu" } */
export function parseAddress(value: string | undefined | null): Address | null {
  if (!value) return null;
  const angle = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  const email = (angle ? angle[2] : value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const name = angle?.[1]?.trim() || null;
  return { name, email };
}

/** Splits a header such as To or Cc on commas outside quotes. */
export function parseAddressList(value: string | undefined | null): Address[] {
  if (!value) return [];
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    if (ch === "," && !quoted) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts.map(parseAddress).filter((a): a is Address => a !== null);
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Readable text from HTML: drops scripts/styles, keeps line breaks, decodes common entities. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
};

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

/** Prefers the text/plain part, falls back to text/html converted to text. */
export function extractBody(payload: GmailPart): string {
  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data).trim();
  const html = findPart(payload, "text/html");
  if (html?.body?.data) return htmlToText(decodeBase64Url(html.body.data));
  return "";
}

/** Cuts quoted replies ("On … wrote:", "… írta:") so only the new message remains. */
export function stripQuotedReply(text: string): string {
  const markers = [/^On .+wrote:\s*$/m, /^.{0,200}írta:\s*$/m, /^-{2,}\s*Original Message\s*-{2,}/im, /^>.*$/m];
  let end = text.length;
  for (const m of markers) {
    const hit = m.exec(text);
    if (hit && hit.index > 0 && hit.index < end) end = hit.index;
  }
  return text.slice(0, end).trim();
}

export function header(payload: GmailPart, name: string): string | undefined {
  return payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}
