"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// One expanded row per page: opening another closes the first, and a click
// outside the open row closes it.

let current: string | null = null;
const listeners = new Set<() => void>();
const emit = (id: string | null) => {
  current = id;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether this row is the open one, a setter, and the ref for its outer element. */
export function useOneOpen<T extends HTMLElement>(id: string, openFirst = false) {
  const open = useSyncExternalStore(subscribe, () => current === id, () => false);
  const ref = useRef<T>(null);

  // The first row asking to start open gets it (e.g. the first email awaiting approval).
  useEffect(() => {
    if (openFirst && current === null) emit(id);
  }, [id, openFirst]);

  useEffect(() => {
    if (!open) return;
    // On the finished click, not on press: closing on press shifts the list
    // under the pointer, and the click meant for the next row would miss it.
    // A row opened by this very click has already taken over by now.
    const close = (e: MouseEvent) => {
      if (current === id && !ref.current?.contains(e.target as Node)) emit(null);
    };
    document.addEventListener("click", close);
    return () => {
      document.removeEventListener("click", close);
      // Leaving the page with this row open: the next page starts closed.
      if (current === id) current = null;
    };
  }, [open, id]);

  return { open, setOpen: (o: boolean) => emit(o ? id : current === id ? null : current), ref };
}
