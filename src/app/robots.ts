import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/site";

// Only the public pages are for crawlers: everything else needs sign-in or is
// a private link (shared listings, bookings, viewing replies, invitations).
// AI assistants' crawlers are welcome on the same pages, so they can describe
// Flavio correctly; llms.txt gives them a summary.
// Scripts, styles and icons too: search engines render the page with them.
const allow = [
  "/$",
  ...PUBLIC_PAGES.filter((p) => p.path !== "/").map((p) => p.path),
  "/llms.txt",
  "/_next/",
  "/opengraph-image",
  "/icon.svg",
  "/favicon.ico",
  "/apple-icon",
  "/manifest.webmanifest",
];

const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow, disallow: "/" },
      { userAgent: AI_CRAWLERS, allow, disallow: "/" },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
