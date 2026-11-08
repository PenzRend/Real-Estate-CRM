"use client";

import { AudioLines, Loader2, Menu, Mic, Search, X } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { VOICE_EVENT } from "@/components/assistant/voice-event";
import { openSearch } from "./command-palette";
import { FeedbackButton } from "./feedback-button";
import { Logo } from "./logo";
import { useChatUnread } from "@/components/chat/use-chat-unread";
import { navItems, teamNavItems, type NavItem } from "./nav-items";

/** A small spinner on the clicked item while its page is still loading (only shows when that takes a moment). */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <Loader2 aria-hidden className={cn("ml-auto size-3.5 animate-spin text-subtle transition-opacity", pending ? "opacity-100 delay-150" : "opacity-0")} />
  );
}

function NavList({
  pathname,
  onNavigate,
  items = navItems,
  label = "Fő navigáció",
}: {
  pathname: string | null;
  onNavigate?: () => void;
  items?: NavItem[];
  label?: string;
}) {
  // The clicked item lights up at once, before its page has loaded; it is dropped as soon as the URL changes.
  const [clicked, setClicked] = useState<{ href: string; on: string | null } | null>(null);
  const current = clicked && clicked.on === pathname ? clicked.href : pathname;
  const unread = useChatUnread(pathname);
  return (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon, also = [], children }) => {
        const active = current != null && [href, ...also].some((h) => current === h || current.startsWith(`${h}/`));
        return (
          <Fragment key={href}>
            <Link
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
              {href === "/messages" && unread > 0 && (
                <span
                  className="pop-in grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-white"
                  aria-label={`${unread} olvasatlan`}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
              <PendingDot />
            </Link>
            {/* The open item's sub-pages, branching off below it. */}
            {active && children && (
              <ul className="reveal relative mt-0.5 mb-1 ml-[1.45rem] flex flex-col gap-0.5 pl-3.5 before:absolute before:top-0 before:bottom-[1.05rem] before:left-0 before:w-px before:bg-border-strong">
                {children.map((c) => {
                  const on = current != null && (current === c.href || (!c.exact && current.startsWith(`${c.href}/`)));
                  return (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        onClick={() => {
                          setClicked({ href: c.href, on: pathname });
                          onNavigate?.();
                        }}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "relative flex items-center rounded-full px-3 py-1.5 text-[13px] transition-colors",
                          "before:absolute before:top-1/2 before:-left-3.5 before:h-px before:w-3 before:bg-border-strong",
                          on ? "bg-surface font-medium text-ink" : "text-muted hover:text-ink",
                        )}
                      >
                        {c.label}
                        <PendingDot />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function ActiveNavList({ onNavigate, items }: { onNavigate?: () => void; items?: NavItem[] }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} items={items} label={items === teamNavItems ? "Csapat" : undefined} />;
}

/** The URL is request data, so the highlight streams in; the links render immediately. */
function NavLinks({ onNavigate, items }: { onNavigate?: () => void; items?: NavItem[] }) {
  return (
    <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} items={items} />}>
      <ActiveNavList onNavigate={onNavigate} items={items} />
    </Suspense>
  );
}

/** Chat and the office's numbers: only for offices with colleagues (the layout decides). */
export function TeamNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3.5 pt-2 text-[11px] font-medium tracking-wide text-subtle uppercase">Csapat</p>
      <NavLinks onNavigate={onNavigate} items={teamNavItems} />
    </div>
  );
}

/** Say what to do ("készíts foglalási szerződést a Kiss-ügyletre"): the assistant opens, listens and does it. */
function VoiceButton({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        window.dispatchEvent(new Event(VOICE_EVENT));
      }}
      title="Mondd Flaviónak – például: „írj fel egy feladatot holnapra”"
      aria-label="Mondd Flaviónak"
      className={cn(
        "flex items-center justify-center gap-2 rounded-full border border-accent/30 bg-accent-soft/50 text-sm font-medium text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft",
        compact ? "size-9" : "h-11",
      )}
    >
      <AudioLines className="size-4" />
      {!compact && "Mondd Flaviónak"}
    </button>
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

export function Sidebar({ account, team, plan }: { account: ReactNode; team?: ReactNode; plan?: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-border px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <div className="flex flex-col gap-4">
        <VoiceButton />
        <CaptureButton />
        <SearchButton />
        <NavLinks />
        {team}
      </div>
      <div className="mt-auto flex flex-col gap-3">
        {plan}
        <FeedbackButton />
        {account}
      </div>
    </aside>
  );
}

export function MobileNav({ account, team, plan }: { account: ReactNode; team?: ReactNode; plan?: ReactNode }) {
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
          <VoiceButton compact />
          <Link href="/interactions/new" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-white">
            <Mic className="size-4" /> Rögzítés
          </Link>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menü">
          <button type="button" className="drawer-backdrop absolute inset-0 bg-ink/20" aria-label="Menü bezárása" onClick={() => setOpen(false)} />
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
              <VoiceButton onNavigate={() => setOpen(false)} />
              <CaptureButton onNavigate={() => setOpen(false)} />
              <NavLinks onNavigate={() => setOpen(false)} />
              {/* Streamed from the server, so it closes the menu itself when a link is followed. */}
              <div onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}>{team}</div>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <div onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}>{plan}</div>
              <FeedbackButton />
              {account}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
