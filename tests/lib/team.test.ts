import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashInviteToken, newInviteToken } from "@/lib/team";

describe("invite tokens", () => {
  it("are long, URL-safe and different each time", () => {
    const a = newInviteToken();
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(newInviteToken()).not.toBe(a);
  });

  it("are stored as a 64-character SHA-256 hash", () => {
    expect(hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
