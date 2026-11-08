"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

// Screens that share one menu item (Teendők: tasks and calendar;
// Dokumentumok: files, contracts and templates) switch between each other
// here, at the top of the page.

export const TODO_SECTIONS = [
  { href: "/tasks", label: "Feladatok" },
  { href: "/calendar", label: "Naptár" },
];

export const DOCUMENT_SECTIONS = [
  { href: "/documents", label: "Fájlok", exact: true },
  { href: "/contracts", label: "Szerződések" },
  { href: "/documents/templates", label: "Dokumentumkészítő" },
];

export function SectionSwitch({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Részek" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border p-1 [scrollbar-width:none]">
      {items.map((i) => {
        const active = pathname === i.href || (!i.exact && pathname.startsWith(`${i.href}/`));
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors", active ? "bg-primary font-medium text-white" : "text-muted hover:text-ink")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
