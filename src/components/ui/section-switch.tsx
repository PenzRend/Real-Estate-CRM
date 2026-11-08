"use client";

import { FileSignature, FolderOpen, Wand2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";

// On a phone, where the menu is folded away, the screens of one menu item
// (Dokumentumok: files, contracts, the document creator) switch here; on a
// computer the menu shows them as a branch under the item. Drawn by the
// group's layout ((dokumentumok)), so it stays in place while the page below
// changes.

type Section = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const groups: Record<"dokumentumok", Section[]> = {
  dokumentumok: [
    { href: "/documents", label: "Fájlok", icon: FolderOpen, exact: true },
    { href: "/contracts", label: "Szerződések", icon: FileSignature },
    { href: "/documents/templates", label: "Dokumentumkészítő", icon: Wand2 },
  ],
};

function Bar({ group, pathname }: { group: keyof typeof groups; pathname: string | null }) {
  return (
    <nav aria-label="Részek" className="mb-8 flex justify-center lg:hidden">
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface-strong p-1.5 [scrollbar-width:none]">
        {groups[group].map(({ href, label, icon: Icon, exact }) => {
          const active = pathname != null && (pathname === href || (!exact && pathname.startsWith(`${href}/`)));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
                active ? "bg-background font-medium text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="hidden size-4 sm:block" strokeWidth={active ? 2 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ActiveBar({ group }: { group: keyof typeof groups }) {
  return <Bar group={group} pathname={usePathname()} />;
}

/** The address is request data, so the highlight streams in; the bar itself is there at once, the same size. */
export function SectionBar({ group }: { group: keyof typeof groups }) {
  return (
    <Suspense fallback={<Bar group={group} pathname={null} />}>
      <ActiveBar group={group} />
    </Suspense>
  );
}
