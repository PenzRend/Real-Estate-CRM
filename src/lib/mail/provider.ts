// The mail providers an agent can connect, as the screens name them. Safe for
// client components: no tokens or server calls here.

export type MailProvider = "gmail" | "outlook";

export const providerLabels: Record<MailProvider, string> = { gmail: "Gmail", outlook: "Outlook" };
export const calendarLabels: Record<MailProvider, string> = { gmail: "Google Naptár", outlook: "Outlook-naptár" };

/** The name with its Hungarian article: "a Gmail", "az Outlook" ("A"/"Az" to start a sentence). */
export function withArticle(provider: MailProvider, suffix = "", capital = false) {
  const article = /^[aáeéiíoóöőuúüű]/i.test(providerLabels[provider]) ? "az" : "a";
  return `${capital ? article[0].toUpperCase() + article.slice(1) : article} ${providerLabels[provider]}${suffix}`;
}

/** Where "connect" starts for each provider. */
export const connectPaths: Record<MailProvider, string> = { gmail: "/api/mail/google/connect", outlook: "/api/mail/microsoft/connect" };

/**
 * Asks for a further permission (sending, calendar) from whichever provider
 * the agent connected; /api/mail/connect finds it.
 */
export function permissionHref(kind: "send" | "calendar", next: string) {
  return `/api/mail/connect?${kind}=1&next=${encodeURIComponent(next)}`;
}
