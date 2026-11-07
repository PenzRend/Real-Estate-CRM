"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Tabs that live in the URL (`?view=…`), for a page whose header stays put:
 * the pill slides to the clicked tab the moment it is clicked, while only the
 * content below loads. `keep` names other URL values a tab switch carries
 * over (e.g. the chosen mailbox).
 */
/** The tabs as they look before the URL is read (first tab active): same size, so nothing below moves. */
export function ViewTabsPlaceholder({ items, label }: { items: { value: string; label: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="relative isolate flex w-fit max-w-full gap-1 overflow-x-auto [scrollbar-width:none] rounded-full border border-border p-1">
      {items.map((t, i) => (
        <span key={t.value} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap", i === 0 ? "bg-primary font-medium text-white" : "text-muted")}>
          {t.label}
        </span>
      ))}
    </nav>
  );
}

export function ViewTabs({
  param = "view",
  items,
  keep = [],
  label,
}: {
  param?: string;
  /** The first item is the default when the URL has none. */
  items: { value: string; label: string }[];
  keep?: string[];
  label: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get(param) ?? items[0].value;
  // The clicked tab shows as active straight away; dropped once the URL has moved on.
  const [clicked, setClicked] = useState<{ value: string; on: string } | null>(null);
  const active = clicked && clicked.on === fromUrl ? clicked.value : fromUrl;

  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  // The pill is moved by style, not state: it follows the active tab, sliding (CSS transition) after the first placement.
  useLayoutEffect(() => {
    const tab = nav.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
    const p = pill.current;
    if (!tab || !p) return;
    p.style.transition = placed.current ? "" : "none";
    p.style.transform = `translateX(${tab.offsetLeft}px)`;
    p.style.width = `${tab.offsetWidth}px`;
    p.style.opacity = "1";
    placed.current = true;
  }, [active]);

  const href = (value: string) => {
    const q = new URLSearchParams();
    for (const k of keep) {
      const v = params.get(k);
      if (v) q.set(k, v);
    }
    if (value !== items[0].value) q.set(param, value);
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <nav ref={nav} aria-label={label} className="relative isolate flex w-fit max-w-full gap-1 overflow-x-auto [scrollbar-width:none] rounded-full border border-border p-1">
      <span
        ref={pill}
        aria-hidden
        className="absolute top-1 bottom-1 left-0 -z-10 rounded-full bg-primary opacity-0 transition-[transform,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
      />
      {items.map((t) => {
        const on = t.value === active;
        return (
          <Link
            key={t.value}
            href={href(t.value)}
            scroll={false}
            data-tab={t.value}
            aria-current={on ? "page" : undefined}
            onClick={() => on || setClicked({ value: t.value, on: fromUrl })}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors duration-300",
              on ? "font-medium text-white" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
