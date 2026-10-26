// Building an outgoing reply: checks that run before anything is sent, and
// the MIME message Gmail expects. Pure functions, no I/O.

/** Square-bracket gaps the AI left for the agent, e.g. "[időpont]". */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{1,60}\]/g) ?? [])];
}

const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

/** Comma- or semicolon-separated addresses; null when any is invalid or there are none or too many. */
export function parseRecipients(value: string): string[] | null {
  const list = value
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);
  if (!list.length || list.length > 10 || !list.every((a) => ADDRESS.test(a))) return null;
  return [...new Set(list.map((a) => a.toLowerCase()))];
}

/** RFC 2047 encoding for non-ASCII header text; strips line breaks (no header injection). */
export function encodeHeader(value: string) {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

/** A Message-ID header value, as stored in References / In-Reply-To. */
const MESSAGE_ID = /^<[^<>\s]+>$/;

export function buildReplyMime(m: {
  from: string;
  to: string[];
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}): string {
  const headers = [
    `From: ${m.from}`,
    `To: ${m.to.join(", ")}`,
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  // Threading headers make the reply show up in the sender's conversation.
  if (m.inReplyTo && MESSAGE_ID.test(m.inReplyTo)) {
    headers.push(`In-Reply-To: ${m.inReplyTo}`);
    const refs = (m.references ?? "").split(/\s+/).filter((r) => MESSAGE_ID.test(r));
    headers.push(`References: ${[...refs, m.inReplyTo].join(" ")}`);
  }
  const body = Buffer.from(m.body.replace(/\r?\n/g, "\r\n"), "utf8")
    .toString("base64")
    .replace(/.{76}/g, "$&\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

export const toBase64Url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
