import { describe, expect, it } from "vitest";
import { contactLinks, toE164 } from "@/lib/contact";

describe("one-tap contact", () => {
  it("reads Hungarian numbers in every usual form", () => {
    for (const n of ["06 30 123 4567", "+36 30 123 4567", "36301234567", "0036 30 123-4567", "(06-30) 123 45 67", "301234567"]) {
      expect(toE164(n), n).toBe("+36301234567");
    }
    expect(toE164("06 1 234 5678")).toBe("+3612345678");
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(toE164("hívj")).toBeNull();
    expect(toE164("")).toBeNull();
  });

  it("builds the call, SMS, WhatsApp and Viber links", () => {
    expect(contactLinks("06 30 123 4567")).toEqual({
      call: "tel:+36301234567",
      sms: "sms:+36301234567",
      whatsapp: "https://wa.me/36301234567",
      viber: "viber://chat?number=%2B36301234567",
    });
    expect(contactLinks(null)).toBeNull();
  });
});
