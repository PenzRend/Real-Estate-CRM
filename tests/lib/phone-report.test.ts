import { describe, expect, it } from "vitest";
import { bearerToken, callReportSchema } from "@/lib/phone/report";

const one = { number: "06 30 123 4567", direction: "outgoing", startedAt: "2026-10-29T15:00:00+01:00", durationSeconds: 95 };

describe("callReportSchema", () => {
  it("takes one call and normalizes the number", () => {
    const r = callReportSchema.parse(one);
    expect(r).toEqual([{ ...one, number: "+36301234567" }]);
  });

  it("takes a batch of up to 50", () => {
    expect(callReportSchema.parse({ calls: [one, { ...one, direction: "missed", durationSeconds: 0 }] })).toHaveLength(2);
    expect(callReportSchema.safeParse({ calls: Array(51).fill(one) }).success).toBe(false);
    expect(callReportSchema.safeParse({ calls: [] }).success).toBe(false);
  });

  it("refuses bad numbers, directions, times and lengths", () => {
    expect(callReportSchema.safeParse({ ...one, number: "12" }).success).toBe(false);
    expect(callReportSchema.safeParse({ ...one, direction: "rejected" }).success).toBe(false);
    expect(callReportSchema.safeParse({ ...one, startedAt: "yesterday" }).success).toBe(false);
    expect(callReportSchema.safeParse({ ...one, durationSeconds: -1 }).success).toBe(false);
    expect(callReportSchema.safeParse(null).success).toBe(false);
  });
});

describe("bearerToken", () => {
  it("reads the key from the header", () => {
    expect(bearerToken("Bearer abc_DEF-123")).toBe("abc_DEF-123");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
