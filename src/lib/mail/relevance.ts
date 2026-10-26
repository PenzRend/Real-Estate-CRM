// Which emails the CRM keeps. Data minimization: only messages that involve
// a known client, come from a property portal, or clearly look like a
// property inquiry are stored; everything else in the mailbox is skipped.

export const PORTALS: { domain: string; name: string }[] = [
  { domain: "ingatlan.com", name: "ingatlan.com" },
  { domain: "jofogas.hu", name: "Jófogás" },
  { domain: "otthonterkep.hu", name: "Otthontérkép" },
  { domain: "ingatlanbazar.hu", name: "Ingatlanbazár" },
  { domain: "ingatlannet.hu", name: "Ingatlannet" },
  { domain: "alberlet.hu", name: "Albérlet.hu" },
];

/** The sender domain (or a subdomain of it) is a known property portal. */
export function detectPortal(fromEmail: string | null): string | null {
  const domain = fromEmail?.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return PORTALS.find((p) => domain === p.domain || domain.endsWith(`.${p.domain}`))?.name ?? null;
}

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Subject phrases that indicate a buyer, seller or tenant writing about property.
const INQUIRY = [
  /erdeklod/, // érdeklődés, érdeklődöm
  /hirdetes/, // a hirdetésére
  /megtekint/, // megtekintés
  /\b(lakas|haz|ingatlan|telek|alberlet)\b/,
  /\b(elado|kiado)\b/,
];
const AUTOMATED = /noreply|no-reply|donotreply|newsletter|hirlevel|mailer-daemon|notification/;

// Portals also send price alerts, saved-search results and newsletters; only
// messages from a person (inquiries, replies) are leads.
const PORTAL_MESSAGE = [/uzenet/, /erdeklod/, /kerdes/, /megtekint/, /kapcsolat/, /visszahiv/, /ajanlat/];
const PORTAL_ALERT = /arfigyelo|valtozott|arcsokken|hirlevel|mentett kereses|uj hirdetes|ajanlo|ertesito|osszefoglalo/;

export function isPortalInquiry(subject: string | null): boolean {
  if (!subject) return false;
  const s = normalize(subject);
  return !PORTAL_ALERT.test(s) && PORTAL_MESSAGE.some((r) => r.test(s));
}

export function looksLikeInquiry(subject: string | null, fromEmail: string | null): boolean {
  if (!subject) return false;
  if (fromEmail && AUTOMATED.test(fromEmail.toLowerCase()) && !detectPortal(fromEmail)) return false;
  const s = normalize(subject);
  return !PORTAL_ALERT.test(s) && INQUIRY.some((r) => r.test(s));
}

export type Classification =
  | { keep: false }
  | { keep: true; reason: "client" | "portal" | "inquiry"; portal: string | null; clientEmail: string | null };

/**
 * Decides whether to store a message. `clientEmails` are the workspace's
 * known client addresses (lowercase); `ownEmail` is the mailbox address.
 */
export function classifyEmail(
  m: { from: string | null; to: string[]; subject: string | null },
  clientEmails: Set<string>,
  ownEmail: string,
): Classification {
  const own = ownEmail.toLowerCase();
  const outgoing = m.from === own;
  // The other party: sender for incoming mail, recipients for outgoing mail.
  const counterparts = (outgoing ? m.to : [m.from]).filter((e): e is string => Boolean(e) && e !== own);

  const clientEmail = counterparts.find((e) => clientEmails.has(e)) ?? null;
  if (clientEmail) return { keep: true, reason: "client", portal: null, clientEmail };

  if (!outgoing) {
    const portal = detectPortal(m.from);
    if (portal) {
      return isPortalInquiry(m.subject) ? { keep: true, reason: "portal", portal, clientEmail: null } : { keep: false };
    }
    if (looksLikeInquiry(m.subject, m.from)) return { keep: true, reason: "inquiry", portal: null, clientEmail: null };
  }
  return { keep: false };
}
