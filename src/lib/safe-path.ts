/**
 * A redirect target from user input, kept to this site's own paths:
 * "/clients?view=1" passes, "//evil.com", "/\evil.com" and "https://…" fall
 * back. Browsers read "\" as "/", so it is rejected anywhere in the value.
 */
export function safePath(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\s]/.test(value)) return fallback;
  const base = "http://flavio.invalid";
  try {
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
