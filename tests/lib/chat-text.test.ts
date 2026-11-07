import { describe, expect, it } from "vitest";
import { chatNoticeText, chatRecipients } from "@/lib/chat/notify";
import { mentionAtCursor, mentionedUsernames, splitMentions } from "@/lib/chat/text";

describe("mentionedUsernames", () => {
  it("finds each mention once, lowercase, and ignores emails", () => {
    expect(mentionedUsernames("@Kata nézd meg, @peter.nagy is! @kata")).toEqual(["kata", "peter.nagy"]);
    expect(mentionedUsernames("írj a kata@example.test címre")).toEqual([]);
    expect(mentionedUsernames("@ab túl rövid")).toEqual([]);
  });
});

describe("splitMentions", () => {
  it("cuts text and mentions apart, keeping punctuation outside", () => {
    expect(splitMentions("Szia @kata, kész.")).toEqual([{ text: "Szia " }, { text: "@kata", mention: "kata" }, { text: ", kész." }]);
    expect(splitMentions("@peter.")).toEqual([{ text: "@peter", mention: "peter" }, { text: "." }]);
  });
});

describe("mentionAtCursor", () => {
  it("is the word being typed after @", () => {
    expect(mentionAtCursor("szia @ka", 8)).toEqual({ query: "ka", start: 5 });
    expect(mentionAtCursor("@", 1)).toEqual({ query: "", start: 0 });
    expect(mentionAtCursor("kata@ex", 7)).toBeNull();
    expect(mentionAtCursor("szia @kata ", 11)).toBeNull();
  });
});

describe("chatRecipients", () => {
  const members = new Map([
    ["kata", "u-kata"],
    ["peter", "u-peter"],
    ["anna", "u-anna"],
  ]);
  it("tells the addressee of a direct message only, and members mentioned in the office channel, never the sender", () => {
    expect(chatRecipients({ senderId: "u-anna", recipientId: "u-kata", body: "@kata @peter nézd" }, members)).toEqual([{ userId: "u-kata", reason: "direct" }]);
    expect(chatRecipients({ senderId: "u-anna", recipientId: null, body: "@kata @peter nézd" }, members)).toEqual([
      { userId: "u-kata", reason: "mention" },
      { userId: "u-peter", reason: "mention" },
    ]);
    expect(chatRecipients({ senderId: "u-anna", recipientId: null, body: "@anna @idegen szia" }, members)).toEqual([]);
    expect(chatRecipients({ senderId: "u-anna", recipientId: null, body: "Mindenkinek szia" }, members)).toEqual([]);
  });
});

describe("chatNoticeText", () => {
  it("names the sender and says what was shared when there is no text", () => {
    expect(chatNoticeText({ userId: "x", reason: "direct" }, "Anna", { body: "", refKind: "client", recipientId: "x" })).toEqual({ title: "Anna", body: "Megosztott egy ügyfelet." });
    expect(chatNoticeText({ userId: "x", reason: "mention" }, "Anna", { body: "@kata kész", refKind: null, recipientId: null }).title).toBe("Anna megemlített az irodai csevegésben");
  });
});
