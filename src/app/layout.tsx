import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "Ingatlan CRM", template: "%s · Ingatlan CRM" },
  description: "Ügyfelek, ingatlanok és utánkövetés egy helyen, AI-támogatással.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The import extension marks <html> (data-crm-extension) before React loads.
    <html lang="hu" className={`${onest.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
