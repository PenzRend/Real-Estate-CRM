import { describe, expect, it } from "vitest";
import { chatNoticeText, chatRecipients } from "@/lib/chat/notify";
import { encodeMentions, mentionAtCursor, mentionedIds, plainText, splitMentions } from "@/lib/chat/text";

const KATA = "11111111-1111-4111-8111-111111111111";
const PETER = "22222222-2222-4222-8222-222222222222";
const ANNA = "33333333-3333-4333-8333-333333333333";
const names = new Map([
  [KATA, "Kiss Kata"],
  [PETER, "Nagy Péter"],
  [ANNA, "Kovács Anna"],
]);

describe("mentions", () => {
  it("turns picked names into tokens, longest name first, and reads them back", () => {
    const body = encodeMentions("@Kiss Kata és @Nagy Péter, nézzétek! @Kiss Kata", [
      { id: KATA, name: "Kiss Kata" },
      { id: PETER, name: "Nagy Péter" },
    ]);
    expect(body).toBe(`<@${KATA}> és <@${PETER}>, nézzétek! <@${KATA}>`);
    expect(mentionedIds(body)).toEqual([KATA, PETER]);
    expect(plainText(body, (id) => names.get(id))).toBe("@Kiss Kata és @Nagy Péter, nézzétek! @Kiss Kata");
    expect(
      encodeMentions("@Kovács Anna Mária és @Kovács Anna", [
        { id: ANNA, name: "Kovács Anna" },
        { id: KATA, name: "Kovács Anna Mária" },
      ]),
    ).toBe(`<@${KATA}> és <@${ANNA}>`);
  });

  it("cuts a message into text and mentions", () => {
    expect(splitMentions(`Szia <@${KATA}>!`)).toEqual([{ text: "Szia " }, { text: `<@${KATA}>`, mention: KATA }, { text: "!" }]);
    expect(splitMentions("írj a kata@example.test címre")).toEqual([{ text: "írj a kata@example.test címre" }]);
  });

  it("finds the name being typed after @, with spaces and accents", () => {
    expect(mentionAtCursor("szia @Kis", 9)).toEqual({ query: "kis", start: 5 });
    expect(mentionAtCursor("szia @Kiss Ká", 13)).toEqual({ query: "kiss ká", start: 5 });
    expect(mentionAtCursor("@", 1)).toEqual({ query: "", start: 0 });
    expect(mentionAtCursor("kata@ex", 7)).toBeNull();
  });
});

describe("chatRecipients", () => {
  const members = new Set([KATA, PETER, ANNA]);
  it("tells the addressee of a direct message only, and members mentioned in the office channel, never the sender", () => {
    expect(chatRecipients({ senderId: ANNA, recipientId: KATA, body: `<@${PETER}> nézd` }, members)).toEqual([{ userId: KATA, reason: "direct" }]);
    expect(chatRecipients({ senderId: ANNA, recipientId: null, body: `<@${KATA}> <@${PETER}> <@${ANNA}>` }, members)).toEqual([
      { userId: KATA, reason: "mention" },
      { userId: PETER, reason: "mention" },
    ]);
    expect(chatRecipients({ senderId: ANNA, recipientId: null, body: "Mindenkinek szia" }, members)).toEqual([]);
  });
});

describe("chatNoticeText", () => {
  it("names the sender, writes mentions as names, and says what was shared when there is no text", () => {
    const nameOf = (id: string) => names.get(id);
    expect(chatNoticeText({ userId: "x", reason: "direct" }, "Anna", { body: "", refKind: "client", recipientId: "x" }, nameOf)).toEqual({ title: "Anna", body: "Megosztott egy ügyfelet." });
    expect(chatNoticeText({ userId: KATA, reason: "mention" }, "Anna", { body: `<@${KATA}> kész`, refKind: null, recipientId: null }, nameOf)).toEqual({
      title: "Anna megemlített az irodai csevegésben",
      body: "@Kiss Kata kész",
    });
  });
});
