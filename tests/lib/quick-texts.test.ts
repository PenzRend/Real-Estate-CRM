import { describe, expect, it } from "vitest";
import { messageLinks, quickTexts } from "@/lib/contact";

describe("quick texts", () => {
  it("greet by first name and sign with the agent's name", () => {
    const t = quickTexts("Kiss Anna", "Orosz Géza");
    expect(t[0].text).toBe("Kedves Anna! Köszönöm a beszélgetést! Ahogy megbeszéltük, hamarosan küldöm a részleteket.\nOrosz Géza");
    expect(quickTexts("", null)[1].text).toBe("Jó napot! Próbáltam elérni telefonon. Kérem, hívjon vissza, amikor alkalmas.");
  });
  it("make SMS and WhatsApp links with the text filled in", () => {
    expect(messageLinks("06 30 123 4567", "Szia!")).toEqual({ sms: "sms:+36301234567?&body=Szia!", whatsapp: "https://wa.me/36301234567?text=Szia!" });
    expect(messageLinks(null, "x")).toBeNull();
  });
});
