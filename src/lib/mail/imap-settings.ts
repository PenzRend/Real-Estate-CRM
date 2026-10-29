// Server addresses for IMAP/SMTP mailboxes (business domains, iCloud, Yahoo…):
// well-known providers, the Thunderbird autoconfig format, and the checks every
// address passes before Flavio connects to it. Pure functions, no I/O.

export type ServerSettings = {
  imap: { host: string; port: number; user: string };
  smtp: { host: string; port: number; user: string };
};

/** Where the agent should go instead of an IMAP form: their provider has a proper sign-in. */
export type Suggestion = "gmail" | "outlook";

export type Discovery = { settings: ServerSettings; source: "preset" | "autoconfig" | "guess"; hint: string | null } | { suggest: Suggestion };

// Implicit TLS or STARTTLS only; plain-text ports are refused below.
export const IMAP_PORTS = [993, 143] as const;
export const SMTP_PORTS = [465, 587] as const;

const ICLOUD_HINT = "Az iCloud-hoz alkalmazásjelszó kell: appleid.apple.com → Bejelentkezés és biztonság → Alkalmazásjelszavak.";
const APP_PASSWORD_HINT = "Ha a fiókodon kétlépcsős azonosítás van, a szolgáltatónál létrehozott alkalmazásjelszót add meg.";

type Preset = { imap: string; imapPort?: number; smtp: string; smtpPort?: number; hint?: string };

const presets: Record<string, Preset> = {
  "icloud.com": { imap: "imap.mail.me.com", smtp: "smtp.mail.me.com", smtpPort: 587, hint: ICLOUD_HINT },
  "me.com": { imap: "imap.mail.me.com", smtp: "smtp.mail.me.com", smtpPort: 587, hint: ICLOUD_HINT },
  "mac.com": { imap: "imap.mail.me.com", smtp: "smtp.mail.me.com", smtpPort: 587, hint: ICLOUD_HINT },
  "yahoo.com": { imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com", hint: APP_PASSWORD_HINT },
  "gmx.net": { imap: "imap.gmx.net", smtp: "mail.gmx.net", smtpPort: 587 },
  "gmx.com": { imap: "imap.gmx.com", smtp: "mail.gmx.com", smtpPort: 587 },
  "zohomail.eu": { imap: "imap.zoho.eu", smtp: "smtp.zoho.eu" },
  "zoho.com": { imap: "imap.zoho.com", smtp: "smtp.zoho.com" },
};

const gmailDomains = new Set(["gmail.com", "googlemail.com"]);
const outlookDomains = new Set(["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.hu", "hotmail.hu", "live.hu"]);

export const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

const settingsFor = (email: string, p: Preset): ServerSettings => ({
  imap: { host: p.imap, port: p.imapPort ?? 993, user: email },
  smtp: { host: p.smtp, port: p.smtpPort ?? 465, user: email },
});

/** Known from the address alone: a preset, or a provider that has its own sign-in. */
export function knownProvider(email: string): Discovery | null {
  const domain = domainOf(email);
  if (gmailDomains.has(domain)) return { suggest: "gmail" };
  if (outlookDomains.has(domain)) return { suggest: "outlook" };
  const preset = presets[domain];
  return preset ? { settings: settingsFor(email, preset), source: "preset", hint: preset.hint ?? APP_PASSWORD_HINT } : null;
}

/**
 * What the domain's mail servers (MX records) say: Google Workspace and
 * Microsoft 365 use their own sign-in, iCloud+ and Zoho custom domains their
 * presets. Null when the MX points elsewhere.
 */
export function fromMx(email: string, mxHosts: string[]): Discovery | null {
  const mx = mxHosts.map((h) => h.toLowerCase().replace(/\.$/, ""));
  const any = (re: RegExp) => mx.some((h) => re.test(h));
  if (any(/(^|\.)(google|googlemail)\.com$/)) return { suggest: "gmail" };
  if (any(/\.mail\.protection\.outlook\.com$/) || any(/(^|\.)outlook\.com$/)) return { suggest: "outlook" };
  if (any(/\.mail\.icloud\.com$/)) return { settings: settingsFor(email, presets["icloud.com"]), source: "preset", hint: ICLOUD_HINT };
  if (any(/\.zoho\.eu$/)) return { settings: settingsFor(email, presets["zohomail.eu"]), source: "preset", hint: APP_PASSWORD_HINT };
  if (any(/\.zoho\.com$/)) return { settings: settingsFor(email, presets["zoho.com"]), source: "preset", hint: APP_PASSWORD_HINT };
  return null;
}

/** The common shared-hosting layout (cPanel, Plesk…): mail.<domain> for both. */
export function guessSettings(email: string): Discovery {
  const host = `mail.${domainOf(email)}`;
  return { settings: settingsFor(email, { imap: host, smtp: host }), source: "guess", hint: APP_PASSWORD_HINT };
}

/** The registrable part of an MX host ("mx1.mail.example.co.hu" → "example.co.hu" is beyond us; two labels is enough here). */
export const mxBaseDomain = (host: string) => host.toLowerCase().replace(/\.$/, "").split(".").slice(-2).join(".");

/**
 * Reads a Thunderbird autoconfig document (autoconfig.thunderbird.net): the
 * first IMAP server and first SMTP server that use TLS or STARTTLS.
 */
export function parseAutoconfig(xml: string, email: string): ServerSettings | null {
  const localPart = email.slice(0, email.lastIndexOf("@"));
  const domain = domainOf(email);
  const fill = (v: string) => v.replace(/%EMAILADDRESS%/g, email).replace(/%EMAILLOCALPART%/g, localPart).replace(/%EMAILDOMAIN%/g, domain);
  const servers = (tag: string, type: string) =>
    [...xml.matchAll(new RegExp(`<${tag}\\s+type="${type}"\\s*>([\\s\\S]*?)</${tag}>`, "g"))].flatMap((m) => {
      const field = (name: string) => m[1].match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`))?.[1] ?? "";
      const socket = field("socketType").toUpperCase();
      const port = Number(field("port"));
      const host = fill(field("hostname"));
      if (!host || !port || (socket !== "SSL" && socket !== "STARTTLS")) return [];
      return [{ host, port, user: fill(field("username")) || email }];
    });
  const imap = servers("incomingServer", "imap").find((s) => (IMAP_PORTS as readonly number[]).includes(s.port));
  const smtp = servers("outgoingServer", "smtp").find((s) => (SMTP_PORTS as readonly number[]).includes(s.port));
  return imap && smtp ? { imap, smtp } : null;
}

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** Settings typed or edited by the agent: real host names and the TLS ports only. */
export function checkSettings(s: ServerSettings): string | null {
  if (!HOST.test(s.imap.host) || !HOST.test(s.smtp.host)) return "Adj meg érvényes szervernevet (pl. mail.irodad.hu).";
  if (!(IMAP_PORTS as readonly number[]).includes(s.imap.port)) return "Az IMAP-port 993 vagy 143 lehet.";
  if (!(SMTP_PORTS as readonly number[]).includes(s.smtp.port)) return "Az SMTP-port 465 vagy 587 lehet.";
  if (!s.imap.user || s.imap.user.length > 320 || !s.smtp.user || s.smtp.user.length > 320) return "Add meg a felhasználónevet.";
  return null;
}
