import { describe, expect, it } from "vitest";
import { composeUrl } from "@/lib/away/logic";
import { buildReplyMime } from "@/lib/mail/compose";
import { checkSettings, fromMx, guessSettings, knownProvider, mxBaseDomain, parseAutoconfig } from "@/lib/mail/imap-settings";
import { isICloudEmail, normalizeAppPassword } from "@/lib/mail/app-password";
import { mailboxLabel, permissionHref, withArticle } from "@/lib/mail/provider";
import { isPublicAddress } from "@/lib/net/address";

describe("finding the mail servers", () => {
  it("sends Gmail and Outlook addresses to their own sign-in", () => {
    expect(knownProvider("agent@gmail.com")).toEqual({ suggest: "gmail" });
    expect(knownProvider("agent@hotmail.hu")).toEqual({ suggest: "outlook" });
  });

  it("knows iCloud, with the app-password hint", () => {
    const d = knownProvider("kata@icloud.com");
    expect(d && "settings" in d && d.settings).toEqual({
      imap: { host: "imap.mail.me.com", port: 993, user: "kata@icloud.com" },
      smtp: { host: "smtp.mail.me.com", port: 587, user: "kata@icloud.com" },
    });
    expect(d && "hint" in d && d.hint).toMatch(/alkalmazásjelszó/);
    expect(knownProvider("info@irodam.hu")).toBeNull();
  });

  it("reads Google Workspace, Microsoft 365 and iCloud+ custom domains from the MX records", () => {
    expect(fromMx("info@iroda.hu", ["aspmx.l.google.com."])).toEqual({ suggest: "gmail" });
    expect(fromMx("info@iroda.hu", ["iroda-hu.mail.protection.outlook.com"])).toEqual({ suggest: "outlook" });
    const icloud = fromMx("en@sajat.hu", ["mx01.mail.icloud.com"]);
    expect(icloud && "settings" in icloud && icloud.settings.imap.host).toBe("imap.mail.me.com");
    expect(fromMx("info@iroda.hu", ["mx.rackhost.hu"])).toBeNull();
    expect(mxBaseDomain("mx1.Rackhost.hu.")).toBe("rackhost.hu");
  });

  it("falls back to mail.<domain>, the usual shared-hosting setup", () => {
    const d = guessSettings("info@ingatlaniroda.hu");
    expect("settings" in d && d.settings).toEqual({
      imap: { host: "mail.ingatlaniroda.hu", port: 993, user: "info@ingatlaniroda.hu" },
      smtp: { host: "mail.ingatlaniroda.hu", port: 465, user: "info@ingatlaniroda.hu" },
    });
  });

  it("reads Thunderbird's autoconfig, skipping unencrypted servers", () => {
    const xml = `<?xml version="1.0"?>
      <clientConfig version="1.1"><emailProvider id="example.hu">
        <incomingServer type="pop3"><hostname>pop.example.hu</hostname><port>995</port><socketType>SSL</socketType></incomingServer>
        <incomingServer type="imap"><hostname>imap.example.hu</hostname><port>143</port><socketType>plain</socketType><username>%EMAILADDRESS%</username></incomingServer>
        <incomingServer type="imap"><hostname>imap.example.hu</hostname><port>993</port><socketType>SSL</socketType><username>%EMAILLOCALPART%</username></incomingServer>
        <outgoingServer type="smtp"><hostname>smtp.%EMAILDOMAIN%</hostname><port>587</port><socketType>STARTTLS</socketType><username>%EMAILADDRESS%</username></outgoingServer>
      </emailProvider></clientConfig>`;
    expect(parseAutoconfig(xml, "anna@example.hu")).toEqual({
      imap: { host: "imap.example.hu", port: 993, user: "anna" },
      smtp: { host: "smtp.example.hu", port: 587, user: "anna@example.hu" },
    });
    expect(parseAutoconfig("<clientConfig/>", "anna@example.hu")).toBeNull();
  });

  it("accepts only real host names and encrypted ports", () => {
    const ok = { imap: { host: "mail.iroda.hu", port: 993, user: "a@iroda.hu" }, smtp: { host: "mail.iroda.hu", port: 587, user: "a@iroda.hu" } };
    expect(checkSettings(ok)).toBeNull();
    expect(checkSettings({ ...ok, imap: { ...ok.imap, port: 110 } })).toMatch(/993/);
    expect(checkSettings({ ...ok, smtp: { ...ok.smtp, port: 25 } })).toMatch(/465/);
    expect(checkSettings({ ...ok, imap: { ...ok.imap, host: "localhost" } })).toMatch(/szervernev/);
    expect(checkSettings({ ...ok, imap: { ...ok.imap, host: "10.0.0.1" } })).toMatch(/szervernev/);
  });
});

describe("addresses Flavio may connect to", () => {
  it("refuses private, loopback and reserved ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ["17.57.152.5", "185.33.12.4", "2a00:1450:4001:81b::200e"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
});

describe("IMAP mailboxes on screen", () => {
  it("names the service behind the address", () => {
    expect(mailboxLabel("imap", "kata@icloud.com")).toBe("iCloud");
    expect(mailboxLabel("imap", "info@iroda.hu")).toBe("IMAP");
    expect(mailboxLabel("gmail", "a@gmail.com")).toBe("Gmail");
    expect(withArticle("imap", "-hozzáférés", true)).toBe("A postafiók-hozzáférés");
  });

  it("asks a permission from a given mailbox", () => {
    expect(permissionHref("calendar", "/calendar", "b4f7c0de-0000-4000-8000-000000000001")).toBe("/api/mail/connect?calendar=1&next=%2Fcalendar&mailbox=b4f7c0de-0000-4000-8000-000000000001");
  });

  it("opens the agent's mail program for a mailbox without web mail", () => {
    expect(composeUrl("imap", { account: "info@iroda.hu", to: "eva@example.test", subject: "Re: Lakás", body: "Kedves Éva!" })).toBe(
      "mailto:eva@example.test?subject=Re%3A%20Lak%C3%A1s&body=Kedves%20%C3%89va%21",
    );
  });

  it("gives SMTP messages their own Message-ID and date", () => {
    const mime = buildReplyMime({ from: "info@iroda.hu", to: ["eva@example.test"], subject: "Re", body: "Szia", inReplyTo: "<orig@x>", messageId: "<abc@iroda.hu>", date: new Date("2026-10-29T10:00:00Z") });
    expect(mime).toContain("Message-ID: <abc@iroda.hu>\r\n");
    expect(mime).toContain("Date: Thu, 29 Oct 2026 10:00:00 +0000\r\n");
    expect(mime).toContain("In-Reply-To: <orig@x>\r\n");
  });
});

describe("Apple app passwords", () => {
  it("accepts the 16 letters however they were pasted, and rejects a normal password", () => {
    expect(normalizeAppPassword(" abcd-efgh-ijkl-mnop ")).toBe("abcd-efgh-ijkl-mnop");
    expect(normalizeAppPassword("ABCDEFGHIJKLMNOP")).toBe("abcd-efgh-ijkl-mnop");
    expect(normalizeAppPassword("abcd efgh ijkl mnop")).toBe("abcd-efgh-ijkl-mnop");
    expect(normalizeAppPassword("Kutya123!")).toBeNull();
    expect(normalizeAppPassword("abcd-efgh-ijkl")).toBeNull();
    expect(isICloudEmail(" Kata@Me.com")).toBe(true);
    expect(isICloudEmail("kata@gmail.com")).toBe(false);
  });
});
