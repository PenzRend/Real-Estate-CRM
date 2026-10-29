"use client";

import { useSearchParams } from "next/navigation";
import { ClientFilterBar, type ClientFilters } from "./clients-list";
import { PropertyFilterBar, type PropertyFilters } from "./properties-list";

// The filter bars of Ügyfelek and Ingatlanok, in their page layouts: they read
// the filters from the URL themselves, so they stay on screen while the list
// below reloads. Keyed by the URL, so "clear filters" empties the fields too.

const CLIENT_KEYS = ["q", "status", "type", "followUp", "budget", "location", "archived", "mine"] as const;
const PROPERTY_KEYS = ["q", "type", "status", "listing", "minPrice", "maxPrice", "minRooms", "minArea", "maxArea", "balcony", "garden", "parking", "archived"] as const;

function read<K extends string>(params: URLSearchParams, keys: readonly K[]) {
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 100);
  }
  return out;
}

export function ClientFiltersFromUrl() {
  const params = useSearchParams();
  return <ClientFilterBar key={params.toString()} filters={read(params, CLIENT_KEYS) as ClientFilters} />;
}

export function PropertyFiltersFromUrl() {
  const params = useSearchParams();
  return <PropertyFilterBar key={params.toString()} filters={read(params, PROPERTY_KEYS) as PropertyFilters} />;
}
