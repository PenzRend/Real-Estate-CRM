import { describe, expect, it } from "vitest";
import { amountWithWords, numberInWords } from "@/lib/contracts/words";

describe("numberInWords", () => {
  it("writes Hungarian numbers the way contracts do", () => {
    expect(numberInWords(0)).toBe("nulla");
    expect(numberInWords(2)).toBe("kettő");
    expect(numberInWords(15)).toBe("tizenöt");
    expect(numberInWords(20)).toBe("húsz");
    expect(numberInWords(22)).toBe("huszonkettő");
    expect(numberInWords(100)).toBe("száz");
    expect(numberInWords(1500)).toBe("ezerötszáz");
    expect(numberInWords(2000)).toBe("kétezer");
    expect(numberInWords(2500)).toBe("kétezer-ötszáz");
    expect(numberInWords(1_000_000)).toBe("egymillió");
    expect(numberInWords(63_500_000)).toBe("hatvanhárommillió-ötszázezer");
    expect(numberInWords(64_900_000)).toBe("hatvannégymillió-kilencszázezer");
    expect(numberInWords(1_250_002)).toBe("egymillió-kétszázötvenezer-kettő");
  });

  it("adds the figures and 'azaz'", () => {
    expect(amountWithWords(6_300_000)).toBe("6 300 000 Ft, azaz hatmillió-háromszázezer forint");
    expect(amountWithWords(null)).toBe("");
  });
});
