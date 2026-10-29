import "server-only";
import { lookup, resolveMx } from "node:dns/promises";
import { ImapFlow, type MessageEnvelopeObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { MailAccessRevoked } from "./google";
import { isPublicAddress } from "@/lib/net/address";
import { checkSettings, domainOf, fromMx, guessSettings, knownProvider, mxBaseDomain, parseAutoconfig, type Discovery, type ServerSettings } from "./imap-settings";
import type { Address } from "./parse";

// Any mailbox reachable over IMAP (reading) and SMTP (sending): business
// domains on shared hosting, iCloud, Yahoo, Zoho… The agent signs in with an
// app password; Flavio keeps it encrypted, like an OAuth refresh token.

export class ImapUnreachable extends Error {}

const TIMEOUT = 20_000;

/**
 * The server's public address, checked before connecting (and connected to by
 * that address, so a DNS answer can't change in between). The TLS certificate
 * is still checked against the host name.
 */
async function publicAddress(host: string) {
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ImapUnreachable(`A(z) ${host} szerver nem található.`);
  }
  const ok = addresses.find((a) => isPublicAddress(a.address));
  if (!ok || addresses.some((a) => !isPublicAddress(a.address))) throw new ImapUnreachable(`A(z) ${host} nem nyilvános levelezőszerver.`);
  return ok.address;
}

/** Finds the server settings for an address: known provider, MX records, Thunderbird's database, then mail.<domain>. */
export async function discoverSettings(email: string): Promise<Discovery> {
  const known = knownProvider(email);
  if (known) return known;
  const domain = domainOf(email);
  const mx = await resolveMx(domain)
    .then((r) => r.sort((a, b) => a.priority - b.priority).map((m) => m.exchange))
    .catch(() => [] as string[]);
  const byMx = fromMx(email, mx);
  if (byMx) return byMx;
  for (const d of [...new Set([domain, ...mx.slice(0, 1).map(mxBaseDomain)])]) {
    const xml = await fetch(`https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(d)}`, { signal: AbortSignal.timeout(8_000) })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    const settings = xml ? parseAutoconfig(xml, email) : null;
    if (settings) return { settings, source: "autoconfig", hint: null };
  }
  return guessSettings(email);
}

async function imapClient(s: ServerSettings, password: string) {
  const address = await publicAddress(s.imap.host);
  return new ImapFlow({
    host: address,
    servername: s.imap.host,
    port: s.imap.port,
    secure: s.imap.port === 993,
    doSTARTTLS: s.imap.port === 993 ? undefined : true, // never send the password unencrypted
    auth: { user: s.imap.user, pass: password },
    logger: false,
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: 60_000,
    disableAutoIdle: true,
  });
}

async function smtpTransport(s: ServerSettings, password: string) {
  const address = await publicAddress(s.smtp.host);
  return nodemailer.createTransport({
    host: address,
    port: s.smtp.port,
    secure: s.smtp.port === 465,
    requireTLS: s.smtp.port !== 465,
    tls: { servername: s.smtp.host },
    auth: { user: s.smtp.user, pass: password },
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: 60_000,
  });
}

const isAuthFailure = (error: unknown) =>
  Boolean(error && typeof error === "object" && ("authenticationFailed" in error || (error as { code?: string }).code === "EAUTH"));

/** Opens a session; a rejected password is MailAccessRevoked (it was changed or the app password revoked). */
async function connect(s: ServerSettings, password: string) {
  const client = await imapClient(s, password);
  client.on("error", () => undefined); // reported through the awaited calls
  try {
    await client.connect();
  } catch (error) {
    if (isAuthFailure(error)) throw new MailAccessRevoked("IMAP login rejected");
    throw new ImapUnreachable(`Nem sikerült csatlakozni: ${s.imap.host}:${s.imap.port}.`);
  }
  return client;
}

/**
 * Checks both servers with the agent's password before anything is saved.
 * Returns the settings that worked: iCloud, for one, may want only the name
 * part of the address as the IMAP user name.
 */
export async function testMailbox(email: string, s: ServerSettings, password: string): Promise<{ ok: true; settings: ServerSettings } | { ok: false; error: string; field: "password" | "imap" | "smtp" }> {
  const problem = checkSettings(s);
  if (problem) return { ok: false, error: problem, field: "imap" };
  const users = [...new Set([s.imap.user, ...(s.imap.host === "imap.mail.me.com" ? [email.slice(0, email.lastIndexOf("@"))] : [])])];
  let working: ServerSettings | null = null;
  for (const user of users) {
    const attempt = { ...s, imap: { ...s.imap, user } };
    try {
      const client = await connect(attempt, password);
      await client.logout().catch(() => undefined);
      working = attempt;
      break;
    } catch (error) {
      if (error instanceof MailAccessRevoked) continue;
      return { ok: false, error: error instanceof ImapUnreachable ? error.message : "A levelezőszerver nem válaszolt.", field: "imap" };
    }
  }
  if (!working) return { ok: false, error: "A szerver elutasította a belépést. Ellenőrizd a jelszót (iCloudnál és kétlépcsős azonosításnál alkalmazásjelszó kell).", field: "password" };
  try {
    const transport = await smtpTransport(working, password);
    await transport.verify();
    transport.close();
  } catch (error) {
    if (isAuthFailure(error)) return { ok: false, error: "Az olvasás működik, de a küldőszerver (SMTP) elutasította a belépést. Ellenőrizd az SMTP-beállításokat.", field: "smtp" };
    return { ok: false, error: error instanceof ImapUnreachable ? error.message : `A küldőszerver nem érhető el: ${working.smtp.host}:${working.smtp.port}.`, field: "smtp" };
  }
  return { ok: true, settings: working };
}

const toAddress = (a: { address?: string; name?: string } | undefined): Address | null => {
  const email = a?.address?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email, name: a?.name?.trim() || null } : null;
};

export type ImapMeta = {
  id: string;
  folder: string;
  uid: number;
  threadId: string | null;
  at: number;
  from: Address | null;
  to: string[];
  subject: string | null;
  replyTo: Address | null;
};

/**
 * A stable id for a message: its Message-ID (the same in Inbox and Sent, and
 * the one Flavio sets on what it sends), else folder + UID.
 */
function messageKey(env: MessageEnvelopeObject | undefined, folder: string, uidValidity: bigint, uid: number) {
  const id = env?.messageId?.trim();
  return id && id.length <= 900 ? id : `${folder}/${uidValidity}/${uid}`;
}

/** Reading one IMAP mailbox: Inbox and Sent, in one session that the caller closes. */
export async function openImapReader(s: ServerSettings, password: string) {
  const client = await connect(s, password);
  const folders = await client.list();
  const sent = folders.find((f) => f.specialUse === "\\Sent")?.path;
  const paths = ["INBOX", ...(sent ? [sent] : [])];
  const listed = new Map<string, ImapMeta>();

  return {
    /** Message ids since the date, newest first (at most `max`). */
    async list(since: Date, max: number) {
      for (const path of paths) {
        const lock = await client.getMailboxLock(path);
        try {
          const status = client.mailbox;
          const uidValidity = status ? status.uidValidity : BigInt(0);
          const uids = (await client.search({ since }, { uid: true })) || [];
          const recent = uids.slice(-max);
          if (!recent.length) continue;
          for await (const m of client.fetch(recent, { uid: true, envelope: true, internalDate: true }, { uid: true })) {
            const env = m.envelope;
            const at = m.internalDate ? new Date(m.internalDate).getTime() : env?.date ? new Date(env.date).getTime() : 0;
            if (at && at < since.getTime()) continue;
            const id = messageKey(env, path, uidValidity, m.uid);
            if (listed.has(id)) continue;
            listed.set(id, {
              id,
              folder: path,
              uid: m.uid,
              threadId: env?.inReplyTo?.trim() || null,
              at,
              from: toAddress(env?.from?.[0]),
              to: [...(env?.to ?? []), ...(env?.cc ?? [])].flatMap((a) => toAddress(a)?.email ?? []),
              subject: env?.subject ?? null,
              replyTo: toAddress(env?.replyTo?.[0]),
            });
          }
        } finally {
          lock.release();
        }
      }
      return [...listed.values()].sort((a, b) => b.at - a.at).slice(0, max);
    },
    /** The plain-text body (HTML-only mail converted to text). */
    async body(id: string) {
      const meta = listed.get(id);
      if (!meta) return "";
      const lock = await client.getMailboxLock(meta.folder);
      try {
        const m = await client.fetchOne(String(meta.uid), { source: { maxLength: 2_000_000 } }, { uid: true });
        if (!m || !m.source) return "";
        const parsed = await simpleParser(m.source, { skipImageLinks: true, skipTextToHtml: true });
        return (parsed.text ?? "").trim();
      } finally {
        lock.release();
      }
    },
    async close() {
      await client.logout().catch(() => client.close());
    },
  };
}

/**
 * Sends a ready MIME message over SMTP, then files a copy in the Sent folder
 * (plain SMTP servers don't), so the agent sees it in their own mail program.
 */
export async function imapSend(s: ServerSettings, password: string, m: { from: string; to: string[]; mime: string }) {
  let transport;
  try {
    transport = await smtpTransport(s, password);
    await transport.sendMail({ envelope: { from: m.from, to: m.to }, raw: m.mime });
  } catch (error) {
    if (isAuthFailure(error)) throw new MailAccessRevoked("SMTP login rejected");
    throw error;
  } finally {
    transport?.close();
  }
  try {
    const client = await connect(s, password);
    try {
      const sent = (await client.list()).find((f) => f.specialUse === "\\Sent")?.path;
      if (sent) await client.append(sent, m.mime, ["\\Seen"]);
    } finally {
      await client.logout().catch(() => client.close());
    }
  } catch (error) {
    // The email is sent; a missing copy in Sent is not worth reporting as a failure.
    console.error("imap sent copy failed", error instanceof Error ? error.message : error);
  }
}
