"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";

/**
 * "Összes levél" controls in the Levelek header: which mailbox, and search.
 * They stay on screen while the list below loads.
 */
export function AllMailToolbar({ mailboxes }: { mailboxes: { id: string; email: string }[] }) {
  const params = useSearchParams();
  if (params.get("view") !== "all" || !mailboxes.length) return null;
  const mailbox = mailboxes.find((m) => m.id === params.get("mb")) ?? mailboxes[0];
  const query = params.get("q") ?? "";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {mailboxes.length > 1 ? (
        <nav aria-label="Postafiók" className="flex flex-wrap gap-1.5">
          {mailboxes.map((m) => (
            <Link
              key={m.id}
              href={`/inbox?view=all&mb=${m.id}`}
              scroll={false}
              aria-current={m.id === mailbox.id ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors duration-200",
                m.id === mailbox.id ? "border-ink bg-ink text-white" : "border-border text-muted hover:text-ink",
              )}
            >
              {m.email}
            </Link>
          ))}
        </nav>
      ) : (
        <p className="text-xs text-muted">{mailbox.email}</p>
      )}
      {/* Keyed by the search, so clearing it from the URL empties the box too. */}
      <Form key={`${mailbox.id}|${query}`} action="/inbox" scroll={false} className="flex gap-2">
        <input type="hidden" name="view" value="all" />
        <input type="hidden" name="mb" value={mailbox.id} />
        <Input name="q" type="search" defaultValue={query} placeholder="Keresés: feladó, tárgy, szöveg" aria-label="Keresés a levelekben" className="h-9 text-sm sm:w-72" />
        <button type="submit" className={buttonClasses("secondary", "sm", "h-9")}>
          <Search /> Keresés
        </button>
      </Form>
    </div>
  );
}
