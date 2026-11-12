// What search engines and AI assistants are told about Flavio: one source for
// the page metadata, the structured data, the sitemap and llms.txt. Every
// statement describes what the product does today.

export const SITE = {
  name: "Flavio",
  title: "Flavio – AI-asszisztens ingatlanosoknak",
  description:
    "AI-alapú CRM magyar ingatlanosoknak. Mondd el a hívást, az AI kitölti az ügyféladatot és felveszi a teendőt; ingatlan–ügyfél párosítás indoklással, Gmail- és Outlook-integráció, forrásokkal válaszoló AI-asszisztens – magyarul.",
  locale: "hu_HU",
};

/** The public address: APP_URL in production, the domain otherwise. */
export function siteUrl() {
  return (process.env.APP_URL || "https://www.flavio.hu").replace(/\/$/, "");
}

/** Public pages worth finding; everything else needs sign-in or is a private link. */
export const PUBLIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/adatvedelem", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/signup", priority: 0.5, changeFrequency: "yearly" as const },
  { path: "/login", priority: 0.2, changeFrequency: "yearly" as const },
];
