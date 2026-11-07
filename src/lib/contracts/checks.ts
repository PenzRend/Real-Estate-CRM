import type { ContractKind } from "./kinds";
import { parseAmount } from "./render";

// Plain checks on a contract's figures and dates, shown on the review screen
// next to the AI's review. Pure, so it is tested.

export type Check = { level: "error" | "warning"; text: string };

const dateOf = (v: string | undefined) => {
  const m = /(\d{4})[.-]\s?(\d{1,2})[.-]\s?(\d{1,2})/.exec(v ?? "");
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
};

export function contractChecks(kind: ContractKind, v: Record<string, string>): Check[] {
  const out: Check[] = [];
  const price = parseAmount(v.vetelar);
  const deposit = parseAmount(kind === "berleti" ? v.kaucio : v.foglalo);
  if ((kind === "foglalasi" || kind === "adasveteli") && price && deposit) {
    if (deposit > price) out.push({ level: "error", text: "A foglaló nagyobb a vételárnál." });
    else if (deposit / price > 0.1) out.push({ level: "warning", text: `A foglaló a vételár ${Math.round((deposit / price) * 100)}%-a. A bíróság a túlzott foglalót mérsékelheti; a szokásos legfeljebb 10%.` });
  }
  const due = dateOf(v.foglalo_hatarido);
  const contract = dateOf(v.szerzodes_datum);
  const handover = dateOf(v.birtokbaadas);
  if (due && contract && due > contract) out.push({ level: "error", text: "A foglaló határideje az adásvételi szerződés után van." });
  if (contract && handover && handover < contract) out.push({ level: "warning", text: "A birtokbaadás az adásvételi szerződés előtt van." });
  if (kind === "megbizasi") {
    const pct = Number((v.jutalek_szazalek ?? "").replace(",", ".").replace("%", ""));
    if (pct && (pct < 0.5 || pct > 10)) out.push({ level: "warning", text: `A ${pct}%-os sikerdíj szokatlan; ellenőrizd.` });
  }
  if ((kind === "berleti" || kind === "foglalasi" || kind === "adasveteli") && v.elado_nev && v.elado_nev === v.vevo_nev) out.push({ level: "error", text: "Az eladó és a vevő ugyanaz a személy." });
  return out;
}
