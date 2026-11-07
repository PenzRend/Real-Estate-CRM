// Amounts in words, as Hungarian contracts write them ("azaz
// hatvanhárommillió-ötszázezer forint"): up to 2000 in one word, above that
// the groups of three joined by hyphens. Pure, so it is tested.

const ONES = ["", "egy", "kettő", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc"];
const ONES_JOINED = ["", "egy", "két", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc"];
const TENS_ALONE = ["", "tíz", "húsz", "harminc", "negyven", "ötven", "hatvan", "hetven", "nyolcvan", "kilencven"];
const TENS_JOINED = ["", "tizen", "huszon", "harminc", "negyven", "ötven", "hatvan", "hetven", "nyolcvan", "kilencven"];

/** 1–999; `joined` when a group name follows ("két" ezer, not "kettő" ezer). */
function upTo999(n: number, joined: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const hundreds = h === 0 ? "" : h === 1 ? "száz" : `${ONES_JOINED[h]}száz`;
  const tens = o === 0 ? TENS_ALONE[t] : TENS_JOINED[t];
  const ones = (joined ? ONES_JOINED : ONES)[o];
  return hundreds + tens + ones;
}

const GROUPS = ["", "ezer", "millió", "milliárd"];

export function numberInWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "nulla";
  if (n >= 1e12) return String(n);
  const parts: string[] = [];
  let rest = n;
  for (let g = 0; rest > 0; g++) {
    const chunk = rest % 1000;
    rest = Math.floor(rest / 1000);
    if (!chunk) continue;
    const name = GROUPS[g];
    // "ezer" alone for 1000–1999; "egymillió", "egymilliárd".
    const words = g === 1 && chunk === 1 ? "" : upTo999(chunk, g > 0);
    parts.unshift(words + name);
  }
  return (value < 0 ? "mínusz " : "") + parts.join(n > 2000 ? "-" : "");
}

/** "63 500 000 Ft, azaz hatvanhárommillió-ötszázezer forint". */
export function amountWithWords(value: number | null | undefined): string {
  if (value == null) return "";
  const figures = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(value)).replace(/ /g, " ");
  return `${figures} Ft, azaz ${numberInWords(value)} forint`;
}
