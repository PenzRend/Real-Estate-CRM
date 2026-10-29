// The mail providers an agent can connect, as the screens name them. Safe for
// client components: no tokens or server calls here.

/** Gmail and Outlook sign in with Google / Microsoft; "imap" is any other mailbox (business domain, iCloud…). */
export type MailProvider = "gmail" | "outlook" | "imap";

export const providerLabels: Record<MailProvider, string> = { gmail: "Gmail", outlook: "Outlook", imap: "postafiók" };
export const calendarLabels: Record<MailProvider, string> = { gmail: "Google Naptár", outlook: "Outlook-naptár", imap: "naptár" };

/** How a connected mailbox is named in lists: the provider, or for IMAP the service behind the address. */
export function mailboxLabel(provider: MailProvider, email: string) {
  if (provider !== "imap") return providerLabels[provider];
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  if (["icloud.com", "me.com", "mac.com"].includes(domain)) return "iCloud";
  if (domain.startsWith("yahoo.")) return "Yahoo";
  return "IMAP";
}

/** The name with its Hungarian article: "a Gmail", "az Outlook", "a postafiók" ("A"/"Az" to start a sentence). */
export function withArticle(provider: MailProvider, suffix = "", capital = false) {
  const article = /^[aáeéiíoóöőuúüű]/i.test(providerLabels[provider]) ? "az" : "a";
  return `${capital ? article[0].toUpperCase() + article.slice(1) : article} ${providerLabels[provider]}${suffix}`;
}

/** Where "connect" starts for each provider (IMAP: the form on the Levelek page). */
export const connectPaths: Record<MailProvider, string> = { gmail: "/api/mail/google/connect", outlook: "/api/mail/microsoft/connect", imap: "/inbox?add=imap" };

/**
 * Asks for a further permission (sending, calendar) from the provider of the
 * given mailbox (the default one when none is given); /api/mail/connect finds it.
 */
export function permissionHref(kind: "send" | "calendar", next: string, mailboxId?: string | null) {
  return `/api/mail/connect?${kind}=1&next=${encodeURIComponent(next)}${mailboxId ? `&mailbox=${mailboxId}` : ""}`;
}
