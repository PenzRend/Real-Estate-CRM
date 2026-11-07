"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clientDuplicatesAction, propertyDuplicatesAction } from "@/app/(app)/duplicate-actions";
import type { Duplicate } from "@/lib/duplicates";

/**
 * Watches the surrounding form's fields and, a moment after typing stops,
 * shows clients or listings that already match – with whose they are – so the
 * same lead isn't added twice. It never blocks saving.
 */
export function DuplicateWatch({ kind, excludeId }: { kind: "client" | "property"; excludeId?: string | null }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [found, setFound] = useState<Duplicate[]>([]);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";
    const check = () => {
      const input = kind === "client" ? { name: value("full_name"), phone: value("phone"), email: value("email") } : { address: value("address"), city: value("city"), sourceUrl: value("source_url") };
      const key = JSON.stringify(input);
      if (key === last) return;
      last = key;
      const run = kind === "client" ? clientDuplicatesAction(input, excludeId) : propertyDuplicatesAction(input, excludeId);
      void run.then(setFound).catch(() => setFound([]));
    };
    const onInput = (e: Event) => {
      const name = (e.target as HTMLInputElement).name;
      if (!["full_name", "phone", "email", "address", "city"].includes(name)) return;
      clearTimeout(timer);
      timer = setTimeout(check, 600);
    };
    form.addEventListener("input", onInput);
    form.addEventListener("focusout", onInput);
    // A form opened with values (an import, a capture) is checked at once.
    timer = setTimeout(check, 300);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", onInput);
      form.removeEventListener("focusout", onInput);
    };
  }, [kind, excludeId]);

  return (
    <div ref={anchor} className="sm:col-span-2">
      {found.length > 0 && (
        <div role="status" className="reveal flex items-start gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Lehet, hogy {kind === "client" ? "ez az ügyfél" : "ez az ingatlan"} már megvan:</p>
            <ul className="flex flex-col gap-0.5">
              {found.map((d) => (
                <li key={d.id}>
                  <Link href={d.href} target="_blank" className="font-medium text-ink underline underline-offset-2">
                    {d.name}
                  </Link>{" "}
                  <span className="text-warning/90">
                    – {d.reason}
                    {d.agent && `, felelős: ${d.agent}`}
                    {d.archived && " (archivált)"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-warning/80">Ha mégis új, nyugodtan mentsd.</p>
          </div>
        </div>
      )}
    </div>
  );
}
