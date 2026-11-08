// One-tap contact: a client's phone number as links for calling, SMS,
// WhatsApp and Viber, and the outcomes of a call. Pure, safe for the browser.

/**
 * A Hungarian (or international) number in E.164 form: "06 30 123 4567",
 * "+36301234567" and "36 30 123 4567" all become "+36301234567". Null when it
 * doesn't look like a phone number.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("06")) digits = `+36${digits.slice(2)}`;
  else if (/^36\d{8,9}$/.test(digits)) digits = `+${digits}`;
  else if (/^\d{8,9}$/.test(digits)) digits = `+36${digits}`;
  if (!digits.startsWith("+")) digits = `+${digits}`;
  const n = digits.slice(1);
  return /^\d{8,15}$/.test(n) ? `+${n}` : null;
}

export type ContactLinks = { call: string; sms: string; whatsapp: string; viber: string };

export function contactLinks(phone: string | null | undefined): ContactLinks | null {
  const e164 = toE164(phone);
  if (!e164) return null;
  return {
    call: `tel:${e164}`,
    sms: `sms:${e164}`,
    whatsapp: `https://wa.me/${e164.slice(1)}`,
    viber: `viber://chat?number=${encodeURIComponent(e164)}`,
  };
}

export const CALL_OUTCOMES = {
  talked: { label: "Megbeszéltük", summary: "Hívás – beszéltünk", followUpDays: null },
  no_answer: { label: "Nem vette fel", summary: "Hívás – nem vette fel", followUpDays: 1 },
  call_back: { label: "Visszahív / később", summary: "Hívás – később visszahívás", followUpDays: 2 },
  busy: { label: "Foglalt volt", summary: "Hívás – foglalt", followUpDays: 1 },
} as const;
export type CallOutcome = keyof typeof CALL_OUTCOMES;

/** Ready texts for the contact bar's "Gyors üzenet": polite, with the client's first name and the agent's name. */
export function quickTexts(clientName: string, agent: string | null): { label: string; text: string }[] {
  // Hungarian order: the first name is the last word.
  const first = clientName.trim().split(/\s+/).at(-1) ?? "";
  const hi = first ? `Kedves ${first}!` : "Jó napot!";
  const sign = agent ? `\n${agent}` : "";
  return [
    { label: "Köszönöm a beszélgetést", text: `${hi} Köszönöm a beszélgetést! Ahogy megbeszéltük, hamarosan küldöm a részleteket.${sign}` },
    { label: "Kérem, hívjon vissza", text: `${hi} Próbáltam elérni telefonon. Kérem, hívjon vissza, amikor alkalmas.${sign}` },
    { label: "Megtekintés megerősítése", text: `${hi} Megerősítem a megbeszélt megtekintést. Ha közbejön valami, kérem, jelezze.${sign}` },
    { label: "Késem", text: `${hi} Kb. 10 perc késéssel érkezem, elnézést kérek!${sign}` },
    { label: "Elküldtem e-mailben", text: `${hi} Elküldtem e-mailben az ingatlan adatait, kérem, nézze meg.${sign}` },
  ];
}

/** SMS and WhatsApp links with the text already written. */
export function messageLinks(phone: string | null | undefined, text: string): { sms: string; whatsapp: string } | null {
  const e164 = toE164(phone);
  if (!e164) return null;
  return { sms: `sms:${e164}?&body=${encodeURIComponent(text)}`, whatsapp: `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(text)}` };
}
