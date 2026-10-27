import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildXlsx, columnName, crc32 } from "@/lib/export/xlsx";

/** Reads the stored entries back out of the zip by walking the local headers. */
function entries(file: Uint8Array) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const out = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const method = view.getUint16(at + 8, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(file.subarray(at + 30, at + 30 + nameLength));
    const data = file.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    out.set(name, new TextDecoder().decode(method === 0 ? data : inflateRawSync(data)));
    at += 30 + nameLength + size;
  }
  return out;
}

describe("xlsx export", () => {
  it("names columns like Excel", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes a workbook with escaped text, numbers and a bold header", () => {
    const files = entries(
      buildXlsx([
        { name: "Ügyfelek", rows: [["Név", "Keret"], ["Kovács & <Anna>", 80_000_000], ["Üres", null]] },
        { name: "Ügyfelek", rows: [["Feladat"]] },
      ]),
    );
    expect([...files.keys()]).toContain("xl/worksheets/sheet2.xml");
    const sheet = files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Név</t></is></c>');
    expect(sheet).toContain("Kovács &amp; &lt;Anna&gt;");
    expect(sheet).toContain('<c r="B2"><v>80000000</v></c>');
    expect(sheet).not.toContain('r="B3"');
    // Duplicate sheet names would make Excel refuse the file.
    expect(files.get("xl/workbook.xml")).toMatch(/name="Ügyfelek".*name="Ügyfelek 2"/);
  });
});
