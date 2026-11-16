import { describe, expect, it } from "vitest";
import { echoesHint, looksMadeUp, spokenText } from "@/lib/ai/silence";

describe("looksMadeUp", () => {
  it("catches capitals and credit lines from silence", () => {
    expect(looksMadeUp("A TORONTOS KÖZÖNÖT")).toBe(true);
    expect(looksMadeUp("Feliratok: Magyar Közösség")).toBe(true);
    expect(looksMadeUp("Köszönöm a figyelmet!")).toBe(true);
    expect(looksMadeUp("Köszönöm.")).toBe(true);
    expect(looksMadeUp("A")).toBe(true);
  });
  it("keeps real dictation, abbreviations included", () => {
    expect(looksMadeUp("Nyisd meg Kovács Péter adatlapját")).toBe(false);
    expect(looksMadeUp("Az OTP hitelről beszéltünk, köszönöm a segítséget neki is.")).toBe(false);
    expect(looksMadeUp("BKV")).toBe(false);
    expect(looksMadeUp("Igen.")).toBe(false);
  });
});

describe("spokenText", () => {
  it("drops the segments marked as not speech", () => {
    expect(
      spokenText({
        text: "Hívd fel Annát. KÖSZÖNÖM",
        segments: [
          { text: " Hívd fel Annát.", no_speech_prob: 0.02, avg_logprob: -0.2 },
          { text: " KÖSZÖNÖM", no_speech_prob: 0.8, avg_logprob: -1.3 },
        ],
      }),
    ).toBe("Hívd fel Annát.");
  });
  it("uses the plain text when there are no segments", () => {
    expect(spokenText({ text: " Szia " })).toBe("Szia");
  });
});

describe("echoesHint", () => {
  const hint = "Ingatlanos jegyzet. Beszéltem az ügyféllel a megtekintésről: háromszobás téglalakást keres.";
  it("catches the hint repeated back", () => {
    expect(echoesHint("Beszéltem az ügyféllel a megtekintésről.", hint)).toBe(true);
    expect(echoesHint("ingatlanos jegyzet", hint)).toBe(true);
  });
  it("keeps what was really said, even with the same words", () => {
    expect(echoesHint("Beszéltem az ügyféllel, holnap jön a megtekintésre.", hint)).toBe(false);
    expect(echoesHint("Igen", hint)).toBe(false);
  });
});
