"use client";

import { Loader2, Menu, Mic, Plus, Search, X } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { openSearch } from "./command-palette";
import { FeedbackButton } from "./feedback-button";
import { Logo } from "./logo";
import { navItems } from "./nav-items";

/** A small spinner on the clicked item while its page is still loading (only shows when that takes a moment). */
function PendingDot() {
  const { pending } = useLinkStatus();
  return <Loader2 aria-hidden className={cn("ml-auto size-3.5 animate-spin text-subtle transition-opacity", pending ? "opacity-100 delay-150" : "opacity-0")} />;
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  // The clicked item lights up at once, before its page has loaded; it is dropped as soon as the URL changes.
  const [clicked, setClicked] = useState<{ href: string; on: string | null } | null>(null);
  const current = clicked && clicked.on === pathname ? clicked.href : pathname;
  return (
    <nav aria-label="Fő navigáció" className="flex flex-col gap-0.5">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = current != null && (current === href || current.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            onClick={() => {
              setClicked({ href, on: pathname });
              onNavigate?.();
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-colors",
              active ? "bg-surface-strong font-medium text-ink" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.75} />
            {label}
            <PendingDot />
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNavList({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

/** The URL is request data, so the highlight streams in; the links render immediately. */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} />}>
      <ActiveNavList onNavigate={onNavigate} />
    </Suspense>
  );
}

/** The main action: record what just happened. Always one tap away. */
function CaptureButton({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/interactions/new"
      onClick={onNavigate}
      className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover"
    >
      <Mic className="size-4" /> Rögzítés
    </Link>
  );
}

/** Opens Ctrl+K search: anything by name, address, phone, reference. */
function SearchButton({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        openSearch();
      }}
      className="flex h-10 items-center gap-2.5 rounded-full border border-border px-3.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-ink"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Keresés</span>
      <kbd className="hidden rounded border border-border px-1 text-[10px] text-subtle lg:inline">Ctrl K</kbd>
    </button>
  );
}

function QuickAdd({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <p className="px-1 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">Gyors műveletek</p>
      <div className="flex flex-col gap-0.5">
        {[
          { href: "/clients/new", label: "Új ügyfél" },
          { href: "/properties/new", label: "Új ingatlan" },
          { href: "/tasks?new=1", label: "Új feladat" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-text hover:text-ink"
          >
            <Plus className="size-3.5 text-subtle" />
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Sidebar({ account }: { account: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-border px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <div className="flex flex-col gap-4">
        <CaptureButton />
        <SearchButton />
        <NavLinks />
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <QuickAdd />
        <FeedbackButton />
        {account}
      </div>
    </aside>
  );
}

export function MobileNav({ account }: { account: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
        {/* The menu button sits on the left, where the menu slides in from. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid size-9 place-items-center rounded-full border border-border text-ink"
            aria-label="Menü megnyitása"
            aria-expanded={open}
          >
            <Menu className="size-4" />
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openSearch} className="grid size-9 place-items-center rounded-full border border-border text-ink" aria-label="Keresés">
            <Search className="size-4" />
          </button>
          <Link
            href="/interactions/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-white"
          >
            <Mic className="size-4" /> Rögzítés
          </Link>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menü">
          <button
            type="button"
            className="drawer-backdrop absolute inset-0 bg-ink/20"
            aria-label="Menü bezárása"
            onClick={() => setOpen(false)}
          />
          <div className="drawer-panel absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-8 bg-background px-4 py-5 shadow-float">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface"
                aria-label="Menü bezárása"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <CaptureButton onNavigate={() => setOpen(false)} />
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <QuickAdd onNavigate={() => setOpen(false)} />
              <FeedbackButton />
              {account}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
