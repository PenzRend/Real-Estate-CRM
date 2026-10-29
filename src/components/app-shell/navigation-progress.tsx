"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** True for a plain left click on a link to another page of this app (not a new tab, download or the same page). */
function isAppNavigation(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return false;
  return url.pathname + url.search !== location.pathname + location.search;
}

/**
 * A thin bar at the top that starts the moment a link is clicked and finishes
 * when the new page is on screen, so a click never feels ignored while the
 * next page loads.
 */
export function NavigationProgress() {
  const current = `${usePathname()}?${useSearchParams().toString()}`;
  // The URL a navigation started from; it is over once the URL differs.
  const [from, setFrom] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const here = () => `${location.pathname}?${new URLSearchParams(location.search).toString()}`;
    const onClick = (e: MouseEvent) => {
      if (isAppNavigation(e)) setFrom(here());
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Derived during render (no effect): loading while still on the page the click came from.
  const loading = from !== null && from === current;
  if (loading && phase !== "loading") setPhase("loading");
  if (!loading && phase === "loading") {
    setPhase("done");
    setFrom(null);
  }
  // While a page loads, the list that is about to change dims a little (see [data-list-content] in globals.css).
  useEffect(() => {
    document.documentElement.toggleAttribute("data-navigating", phase === "loading");
  }, [phase]);
  // A click that never navigates (e.g. a link that only opens something) gives up after a while.
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setFrom(null), 15_000);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "idle") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        key={phase}
        onAnimationEnd={() => phase === "done" && setPhase("idle")}
        className={phase === "loading" ? "h-full bg-accent [animation:nav-progress_8s_cubic-bezier(.1,.7,.2,1)_both]" : "h-full bg-accent [animation:nav-progress-done_350ms_ease-out_both]"}
      />
    </div>
  );
}
