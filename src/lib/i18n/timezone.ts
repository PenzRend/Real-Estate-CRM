// Conversions between UTC instants and wall-clock values in a time zone
// (for <input type="datetime-local">, which has no zone of its own).

import { DEFAULT_TIMEZONE } from "./format";

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function zoneOffset(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-10-30T10:00" in Budapest → "2026-10-30T09:00:00.000Z". Returns null for malformed input. */
export function zonedLocalToUtc(local: string, timeZone = DEFAULT_TIMEZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const wallAsUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (Number.isNaN(wallAsUtc)) return null;
  // Two passes settle the offset across DST transitions.
  let instant = wallAsUtc - zoneOffset(new Date(wallAsUtc), timeZone);
  instant = wallAsUtc - zoneOffset(new Date(instant), timeZone);
  return new Date(instant).toISOString();
}

/** UTC ISO string → "2026-10-30T10:00" wall clock in `timeZone`, for datetime-local inputs. */
export function utcToZonedLocal(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!iso) return "";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  return new Date(instant.getTime() + zoneOffset(instant, timeZone)).toISOString().slice(0, 16);
}

/** Start of the given calendar day in `timeZone`, as a UTC instant. */
export function startOfZonedDay(instant: Date, timeZone = DEFAULT_TIMEZONE, addDays = 0): Date {
  const local = utcToZonedLocal(instant.toISOString(), timeZone).slice(0, 10);
  const day = new Date(`${local}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + addDays);
  return new Date(zonedLocalToUtc(`${day.toISOString().slice(0, 10)}T00:00`, timeZone)!);
}
