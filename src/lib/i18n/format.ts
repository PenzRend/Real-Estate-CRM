// Hungarian display formatting. Values are stored in UTC / plain numbers and
// localized only at render time.

export const DEFAULT_TIMEZONE = "Europe/Budapest";

const hufFormatter = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
});

const eurFormatter = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** 80000000 → "80 000 000 Ft" */
export function formatPrice(value: number | null | undefined, currency: "HUF" | "EUR" = "HUF") {
  if (value == null) return "—";
  return (currency === "EUR" ? eurFormatter : hufFormatter).format(value);
}

/** 80000000 → "80 M Ft" — for tight spaces such as table cells and chips. */
export function formatPriceShort(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    const millions = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(value / 1_000_000);
    return `${millions} M Ft`;
  }
  return formatPrice(value);
}

/** 2.5 → "2,5" */
export function formatNumber(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(value);
}

export function formatArea(value: number | null | undefined) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(value)} m²`;
}

/** "2026. 10. 25." */
export function formatDate(value: string | Date | null | undefined, timeZone = DEFAULT_TIMEZONE) {
  if (value == null) return "—";
  return new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeZone }).format(new Date(value));
}

/** "2026. 10. 25. 14:30" */
export function formatDateTime(value: string | Date | null | undefined, timeZone = DEFAULT_TIMEZONE) {
  if (value == null) return "—";
  return new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(value),
  );
}

/** "október 25., szombat" — for page headers. */
export function formatLongDate(value: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", timeZone }).format(
    new Date(value),
  );
}
