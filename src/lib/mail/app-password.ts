// Apple app passwords: what they look like, so a pasted normal password is
// caught before Apple turns it down. Pure, safe for client components.

const APP_PASSWORD = /^[a-z]{4}-?[a-z]{4}-?[a-z]{4}-?[a-z]{4}$/i;

/** "abcd efgh ijkl mnop", "abcdefghijklmnop" → "abcd-efgh-ijkl-mnop"; null when it isn't one. */
export function normalizeAppPassword(value: string): string | null {
  const compact = value.replace(/\s+/g, "").toLowerCase();
  if (!APP_PASSWORD.test(compact)) return null;
  const letters = compact.replace(/-/g, "");
  return letters.match(/.{4}/g)!.join("-");
}

export const ICLOUD_DOMAINS = ["icloud.com", "me.com", "mac.com"];

export const isICloudEmail = (email: string) => ICLOUD_DOMAINS.includes(email.trim().slice(email.trim().lastIndexOf("@") + 1).toLowerCase());

/** Where Apple's account page is; app passwords are under Sign-In and Security. */
export const APPLE_ACCOUNT_URL = "https://account.apple.com/";

export const NOT_APP_PASSWORD =
  "Ez nem alkalmazásjelszó. Az Apple-től kapott 16 betűs jelszót másold be (pl. abcd-efgh-ijkl-mnop), ne a rendes Apple-jelszavadat.";
