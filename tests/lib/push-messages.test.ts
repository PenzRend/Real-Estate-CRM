import { describe, expect, it } from "vitest";
import { arrivalsMessage } from "@/lib/push/messages";

const inquiry = { fromName: "Kiss Éva", fromEmail: "eva@example.test", subject: "Érdeklődés: Napfényes lakás", portal: "ingatlan.com", fromClient: false };
const clientMail = { fromName: "Teszt Péter", fromEmail: "peter@example.test", subject: "Re: megtekintés", portal: null, fromClient: true };

describe("notifications about new mail", () => {
  it("names a single portal inquiry and its sender", () => {
    expect(arrivalsMessage([inquiry])).toEqual({
      title: "Új érdeklődés · ingatlan.com",
      body: "Kiss Éva: Érdeklődés: Napfényes lakás – a válaszvázlat a Flavióban vár.",
      url: "/dashboard",
      tag: "new-mail",
    });
  });

  it("names a client's email", () => {
    expect(arrivalsMessage([clientMail])?.title).toBe("Új levél: Teszt Péter");
  });

  it("sums up several in one notification", () => {
    const m = arrivalsMessage([inquiry, clientMail, { ...inquiry, fromName: "Nagy Anna" }, { ...clientMail, fromName: "Kovács Béla" }]);
    expect(m?.title).toBe("2 új érdeklődés és 2 új levél");
    expect(m?.body).toBe("Kiss Éva, Teszt Péter, Nagy Anna és mások – nézd meg a Flavióban.");
    expect(arrivalsMessage([])).toBeNull();
  });
});
