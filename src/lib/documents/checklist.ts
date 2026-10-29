// What a listing needs on paper before (and while) it is advertised, and the
// email that asks the owner for what is missing. Pure, safe for the browser.

export const DOCUMENT_KINDS = ["title_deed", "energy_certificate", "agency_agreement", "floor_plan", "condo_deed", "utility_bills", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const documentKinds: Record<DocumentKind, { label: string; hint: string; required: boolean; fromOwner: boolean }> = {
  title_deed: { label: "Tulajdoni lap", hint: "Friss (30 napnál nem régebbi) tulajdoni lap: tulajdonosok, terhek, jelzálog.", required: true, fromOwner: true },
  energy_certificate: { label: "Energetikai tanúsítvány", hint: "Eladásnál és bérbeadásnál kötelező; a besorolását a hirdetésben is fel kell tüntetni.", required: true, fromOwner: true },
  agency_agreement: { label: "Megbízási szerződés", hint: "Az aláírt közvetítői megbízás (kizárólagos vagy nem).", required: true, fromOwner: false },
  floor_plan: { label: "Alaprajz", hint: "A hirdetéshez és a vevőknek; ha nincs, rajzoltathatunk.", required: false, fromOwner: true },
  condo_deed: { label: "Társasházi alapító okirat, SZMSZ", hint: "Társasházi lakásnál: közös tulajdon, használati jogok.", required: false, fromOwner: true },
  utility_bills: { label: "Közös költség és rezsi", hint: "Az utolsó havi közös költség és közüzemi számlák – a vevők mindig kérdezik.", required: false, fromOwner: true },
  other: { label: "Egyéb", hint: "Pl. használatbavételi engedély, építési engedély, hitelkiváltási igazolás.", required: false, fromOwner: false },
};

export type DocumentRow = { id: string; kind: DocumentKind; fileName: string | null; url: string | null; mark: "not_needed" | "requested" | null; createdAt: string; sizeBytes: number | null };

export type ChecklistItem = {
  kind: DocumentKind;
  label: string;
  hint: string;
  required: boolean;
  files: DocumentRow[];
  status: "done" | "not_needed" | "requested" | "missing";
  requestedAt: string | null;
};

export function checklist(rows: DocumentRow[]): ChecklistItem[] {
  return DOCUMENT_KINDS.map((kind) => {
    const k = documentKinds[kind];
    const files = rows.filter((r) => r.kind === kind && r.fileName);
    const mark = rows.find((r) => r.kind === kind && r.mark);
    const status = files.length ? "done" : mark?.mark === "not_needed" ? "not_needed" : mark?.mark === "requested" ? "requested" : "missing";
    return { kind, label: k.label, hint: k.hint, required: k.required, files, status, requestedAt: mark?.mark === "requested" ? mark.createdAt : null };
  });
}

/** "2/3 kötelező megvan": how far the required documents are. */
export function progress(items: ChecklistItem[]) {
  const required = items.filter((i) => i.required);
  return { done: required.filter((i) => i.status === "done" || i.status === "not_needed").length, total: required.length };
}

/** What can be asked of the owner: the missing documents they hold (required first). */
export const askable = (items: ChecklistItem[]) => items.filter((i) => i.status !== "done" && i.status !== "not_needed" && documentKinds[i.kind].fromOwner && i.kind !== "other");

export function requestEmail(f: { ownerName: string; propertyTitle: string; missing: { label: string; hint: string; required: boolean }[]; agentName: string }): { subject: string; body: string } {
  const lines = [
    `Kedves ${f.ownerName}!`,
    "",
    `A(z) „${f.propertyTitle}” hirdetéséhez és a későbbi adásvételhez a következő dokumentumokra lesz szükségem:`,
    "",
    ...f.missing.map((m) => `– ${m.label}${m.required ? "" : " (ha van)"}: ${m.hint}`),
    "",
    "Elég, ha lefényképezi vagy beszkenneli, és válaszként elküldi erre a levélre.",
    "",
    "Köszönöm!",
    "",
    "Üdvözlettel:",
    f.agentName,
  ];
  return { subject: `Dokumentumok a hirdetéshez: ${f.propertyTitle}`.slice(0, 300), body: lines.join("\n") };
}
