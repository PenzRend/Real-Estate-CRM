import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { SITE, siteUrl } from "@/lib/site";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE.name, template: "%s · Flavio" },
  description: SITE.description,
  applicationName: SITE.name,
  // Signed-in pages and private links say otherwise; see robots.ts.
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: SITE.name, locale: SITE.locale, title: SITE.title, description: SITE.description },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#1b1b1b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The import extension marks <html> (data-crm-extension) before React loads.
    <html lang="hu" className={`${onest.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
