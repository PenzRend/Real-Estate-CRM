import { describe, expect, it } from "vitest";
import { askable, checklist, progress, requestEmail, type DocumentRow } from "@/lib/documents/checklist";

const row = (p: Partial<DocumentRow>): DocumentRow => ({ id: "x", kind: "title_deed", fileName: null, url: null, mark: null, createdAt: "2026-10-29T10:00:00Z", sizeBytes: null, ...p });

describe("listing documents", () => {
  it("tracks the required ones and what was marked or asked for", () => {
    const items = checklist([
      row({ id: "1", kind: "title_deed", fileName: "tulajdoni.pdf" }),
      row({ id: "2", kind: "floor_plan", mark: "not_needed" }),
      row({ id: "3", kind: "energy_certificate", mark: "requested" }),
    ]);
    expect(items.find((i) => i.kind === "title_deed")?.status).toBe("done");
    expect(items.find((i) => i.kind === "floor_plan")?.status).toBe("not_needed");
    expect(items.find((i) => i.kind === "energy_certificate")).toMatchObject({ status: "requested", requestedAt: "2026-10-29T10:00:00Z" });
    expect(progress(items)).toEqual({ done: 1, total: 3 });
    // The owner is asked for what they hold: not the agency agreement, not what is done or not needed.
    expect(askable(items).map((i) => i.kind)).toEqual(["energy_certificate", "condo_deed", "utility_bills"]);
  });

  it("asks the owner politely, marking the optional ones", () => {
    const { subject, body } = requestEmail({
      ownerName: "Kovács János",
      propertyTitle: "Napfényes lakás",
      missing: [
        { label: "Energetikai tanúsítvány", hint: "Kötelező.", required: true },
        { label: "Alaprajz", hint: "Ha van.", required: false },
      ],
      agentName: "Orosz Géza",
    });
    expect(subject).toBe("Dokumentumok a hirdetéshez: Napfényes lakás");
    expect(body).toContain("– Energetikai tanúsítvány: Kötelező.");
    expect(body).toContain("– Alaprajz (ha van): Ha van.");
    expect(body).toContain("válaszként elküldi");
  });
});
