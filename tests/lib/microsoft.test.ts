import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { graphAddress, grantedScopes, microsoftAuthUrl, microsoftScopes } from "@/lib/mail/microsoft";
import { permissionHref, withArticle } from "@/lib/mail/provider";

describe("Microsoft mail", () => {
  it("asks for reading first, sending and the calendar only when needed", () => {
    expect(microsoftScopes({})).toEqual(["openid", "email", "offline_access", "User.Read", "Mail.Read"]);
    expect(microsoftScopes({ send: true, calendar: true })).toContain("Mail.Send");
    expect(microsoftScopes({ send: true, calendar: true })).toContain("Calendars.ReadWrite");
  });

  it("builds the consent URL with PKCE, and keeps the connected account when adding a permission", () => {
    vi.stubEnv("MICROSOFT_CLIENT_ID", "client-id");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "secret");
    const first = new URL(microsoftAuthUrl({ redirectUri: "https://flavio.hu/api/mail/microsoft/callback", state: "s", codeChallenge: "c" }));
    expect(first.origin + first.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(first.searchParams.get("code_challenge_method")).toBe("S256");
    expect(first.searchParams.get("prompt")).toBe("select_account");
    expect(first.searchParams.get("scope")).toBe("openid email offline_access User.Read Mail.Read");
    const more = new URL(microsoftAuthUrl({ redirectUri: "x", state: "s", codeChallenge: "c", send: true, loginHint: "agent@iroda.hu" }));
    expect(more.searchParams.get("login_hint")).toBe("agent@iroda.hu");
    expect(more.searchParams.get("prompt")).toBeNull();
    vi.unstubAllEnvs();
  });

  it("reads granted scopes in either form the token response uses", () => {
    const granted = grantedScopes("https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send openid profile");
    expect(granted.has("mail.read")).toBe(true);
    expect(granted.has("mail.send")).toBe(true);
    expect(granted.has("calendars.readwrite")).toBe(false);
    expect(grantedScopes("Mail.Read User.Read").has("mail.read")).toBe(true);
  });

  it("normalises Graph addresses and drops invalid ones", () => {
    expect(graphAddress({ emailAddress: { address: " Eva@Example.Test ", name: "Kiss Éva" } })).toEqual({ email: "eva@example.test", name: "Kiss Éva" });
    expect(graphAddress({ emailAddress: { address: "not-an-address" } })).toBeNull();
    expect(graphAddress(undefined)).toBeNull();
  });

  it("names the provider with the right Hungarian article", () => {
    expect(withArticle("gmail", "-hozzáférés", true)).toBe("A Gmail-hozzáférés");
    expect(withArticle("outlook", "-hozzáférés", true)).toBe("Az Outlook-hozzáférés");
    expect(withArticle("outlook", "-küldést")).toBe("az Outlook-küldést");
  });

  it("sends permission requests through the provider-neutral route", () => {
    expect(permissionHref("send", "/dashboard")).toBe("/api/mail/connect?send=1&next=%2Fdashboard");
  });
});
