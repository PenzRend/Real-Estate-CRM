"use client";

import { ArrowRight, Building2, CheckSquare, CornerDownLeft, Handshake, Loader2, Mail, Plus, Search, Settings, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { globalSearchAction } from "@/app/(app)/search-actions";
import type { SearchHit } from "@/lib/search/global";
import { cn } from "@/lib/cn";
import { navItems, teamNavItems } from "./nav-items";

type Item = { key: string; group: string; title: string; detail: string | null; href: string; icon: typeof Search };

const groupLabels: Record<SearchHit["group"], { label: string; icon: typeof Search }> = {
  clients: { label: "Ügyfelek", icon: UserRound },
  properties: { label: "Ingatlanok", icon: Building2 },
  deals: { label: "Ügyletek", icon: Handshake },
  emails: { label: "Levelek", icon: Mail },
  tasks: { label: "Feladatok", icon: CheckSquare },
};

const actions: { title: string; href: string; words: string }[] = [
  { title: "Új ügyfél", href: "/clients/new", words: "uj ugyfel vevo hozzaadas" },
  { title: "Új ingatlan", href: "/properties/new", words: "uj ingatlan hirdetes felvetel" },
  { title: "Hirdetés importálása", href: "/properties/import", words: "import hirdetes link ingatlan.com" },
  { title: "Ingatlanok importálása táblázatból", href: "/properties/import/table", words: "import excel csv tablazat ingatlanok crm atallas" },
  { title: "Ügyfelek importálása (Excel, névjegyek)", href: "/clients/import", words: "import ugyfel excel csv nevjegy telefon lista" },
  { title: "Új ügylet", href: "/deals/new", words: "uj ugylet ajanlat foglalo" },
  { title: "Új feladat", href: "/tasks?new=1", words: "uj feladat teendo" },
  { title: "Rögzítés (hívás, találkozó)", href: "/interactions/new", words: "rogzites hivas jegyzet diktalas" },
  { title: "Naptárak kezelése", href: "/settings/calendars", words: "naptar icloud google outlook" },
];

// Screens behind a menu item's tabs or the profile, still found by name.
const moreScreens = [
  ...navItems.flatMap((n) => (n.children ?? []).filter((c) => c.href !== n.href).map((c) => ({ href: c.href, label: c.label, icon: n.icon }))),
  { href: "/assistant", label: "AI-asszisztens", icon: Sparkles },
  { href: "/settings", label: "Beállítások", icon: Settings },
  ...teamNavItems,
];

const plain = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Opens the search: Ctrl+K / ⌘K anywhere, or any element that dispatches "flavio:search". */
export function openSearch() {
  window.dispatchEvent(new Event("flavio:search"));
}

/**
 * Ctrl+K: find a client, a listing, a deal, an email or a task by typing a
 * few letters (accents optional, phone digits work), or jump to a screen or
 * a "new …" form. Arrow keys and Enter, Esc to close.
 */
export function CommandPalette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [searching, start] = useTransition();
  const latest = useRef("");

  const open = useCallback(() => {
    setQuery("");
    setHits([]);
    setActive(0);
    dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("flavio:search", open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("flavio:search", open);
    };
  }, [open]);

  // Searches as you type, a moment after the last key; only the latest answer counts.
  useEffect(() => {
    const q = query.trim();
    latest.current = q;
    if (q.length < 2) return;
    const t = setTimeout(() => {
      start(async () => {
        const r = await globalSearchAction(q).catch(() => []);
        if (latest.current === q) {
          setHits(r);
          setActive(0);
        }
      });
    }, 160);
    return () => clearTimeout(t);
  }, [query]);

  const items: Item[] = useMemo(() => {
    const q = plain(query.trim());
    const screens = [...navItems, ...moreScreens]
      .filter((n) => (q ? plain(n.label).includes(q) : navItems.includes(n as (typeof navItems)[number])))
      .map((n) => ({ key: `nav:${n.href}`, group: "Oldalak", title: n.label, detail: null, href: n.href, icon: n.icon }));
    const quick = actions
      .filter((a) => !q || plain(a.title).includes(q) || a.words.includes(q))
      .map((a) => ({ key: `act:${a.href}`, group: "Gyors műveletek", title: a.title, detail: null, href: a.href, icon: Plus }));
    const found = query.trim().length >= 2 ? hits.map((h) => ({ key: `${h.group}:${h.id}`, group: groupLabels[h.group].label, title: h.title, detail: h.detail, href: h.href, icon: groupLabels[h.group].icon })) : [];
    return [...found, ...quick.slice(0, q ? 4 : 3), ...screens.slice(0, q ? 4 : 8)];
  }, [hits, query]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  };

  let lastGroup = "";
  return (
    <dialog
      ref={dialog}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="m-auto mt-[12vh] w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
      aria-label="Keresés"
    >
      <div className="flex items-center gap-3 border-b border-border px-5">
        {searching ? <Loader2 className="size-5 shrink-0 animate-spin text-muted" /> : <Search className="size-5 shrink-0 text-muted" />}
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(items[active]);
            }
          }}
          placeholder="Ügyfél, ingatlan, ügylet, levél, telefonszám…"
          aria-label="Keresés"
          className="h-14 flex-1 bg-transparent text-[16px] text-ink placeholder:text-subtle focus:outline-none"
        />
        <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted sm:block">Esc</kbd>
      </div>
      <ul className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
        {query.trim().length >= 2 && !searching && !hits.length && <li className="px-3 py-3 text-sm text-muted">Nincs találat erre: „{query.trim()}”.</li>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const Icon = item.icon;
          return (
            <li key={item.key} role="option" aria-selected={i === active}>
              {header && <p className="px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{header}</p>}
              <button
                type="button"
                onMouseMove={() => setActive(i)}
                onClick={() => go(item)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === active ? "bg-surface" : "hover:bg-surface/60")}
              >
                <Icon className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{item.title}</span>
                  {item.detail && <span className="block truncate text-xs text-muted">{item.detail}</span>}
                </span>
                {i === active ? <CornerDownLeft className="size-3.5 shrink-0 text-subtle" /> : <ArrowRight className="size-3.5 shrink-0 text-transparent" />}
              </button>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
