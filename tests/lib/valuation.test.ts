import { describe, expect, it } from "vitest";
import { isComparable, priceCheck, type Comparable, type Subject } from "@/lib/listings/valuation";

const subject: Subject = { propertyType: "apartment", listingType: "sale", city: "Budapest", district: "XI. kerület", areaSqm: 64, rooms: 2.5, price: 77_000_000 };
const comp = (perSqm: number, area = 60): Comparable => ({ id: String(perSqm), title: "x", place: "Budapest", areaSqm: area, rooms: 2, price: perSqm * area, basis: "asking", status: "active", date: "2026-10-01" });

describe("price check", () => {
  it("compares like with like", () => {
    expect(isComparable(subject, { city: "Budapest", district: "XI. kerület", areaSqm: 70, rooms: 3 })).toBe(true);
    expect(isComparable(subject, { city: "budapest", district: null, areaSqm: 50, rooms: 2 })).toBe(true);
    expect(isComparable(subject, { city: "Budapest", district: "II. kerület", areaSqm: 64, rooms: 2 })).toBe(false);
    expect(isComparable(subject, { city: "Debrecen", district: null, areaSqm: 64, rooms: 2 })).toBe(false);
    expect(isComparable(subject, { city: "Budapest", district: "XI. kerület", areaSqm: 100, rooms: 2 })).toBe(false);
    expect(isComparable(subject, { city: "Budapest", district: "XI. kerület", areaSqm: 64, rooms: 4 })).toBe(false);
  });

  it("places the asking price against the median and gives a range", () => {
    const c = priceCheck(subject, [comp(1_000_000), comp(1_100_000), comp(1_200_000), comp(1_300_000), comp(1_400_000)]);
    expect(c.median).toBe(1_200_000);
    expect(c.low).toBe(1_100_000);
    expect(c.high).toBe(1_300_000);
    expect(c.subjectPerSqm).toBe(1_203_125);
    expect(c.difference).toBe(0);
    expect(c.verdict).toBe("fair");
    expect(c.range).toEqual({ from: 70_400_000, to: 83_200_000 });
    expect(c.thin).toBe(false);
  });

  it("calls a clearly higher price high, and says when data is thin or missing", () => {
    expect(priceCheck({ ...subject, price: 96_000_000 }, [comp(1_200_000), comp(1_250_000)])).toMatchObject({ verdict: "high", thin: true, count: 2 });
    expect(priceCheck(subject, [])).toMatchObject({ verdict: "unknown", count: 0, median: null });
  });
});
