// Instructions for turning an agent's call note into structured CRM data.
// The system prompt is static (cacheable); the date context goes in the user turn.

export const CAPTURE_SYSTEM_PROMPT = `You turn notes from a Hungarian real estate agent into structured CRM data.
The input is a call note, a meeting note, a dictated voice memo transcript, or a pasted email. It is usually in Hungarian.

Rules:
- Extract only what the text states or clearly implies. If something is not mentioned, use null, an empty list or false. Never guess names, numbers, dates or contact details.
- Write summary, outcome, decisions, open_questions, promised_actions, task titles, important_dates descriptions and requirements.other in Hungarian, short and factual, in the agent's voice ("Visszahívni pénteken", not "The agent should...").
- summary: one or two sentences about what happened in this conversation.
- client: the other party of the conversation (buyer, seller, owner...). Keep the name as written. Use client_type only if the text makes the role clear.
- Money is in Hungarian forints unless another currency is stated. Convert to whole numbers: "80 millió", "80M", "80 misi" = 80000000. "70-85 millió" gives budget_min 70000000 and budget_max 85000000. A single "about 80 million" ("kb. 80 millió", "80 körül") gives budget_max 80000000 and budget_is_approximate true. "Maximum 80" gives budget_max only.
- Rooms: "2 szobás" means min_rooms 2. "Két hálószobás" / "2 hálós" means min_bedrooms 2. Half rooms count as 0.5.
- locations: places exactly as an agent would file them, e.g. "Budapest XI. kerület", "Budaörs". Convert "tizenegyedik kerület" and "XI. ker" to "Budapest XI. kerület" when Budapest is meant.
- requirements.other: wishes and must-haves that have no own field, as short Hungarian phrases separated by "; ", e.g. "Erkély fontos; Parkoló kérdéses; Nem földszint; Lift kell". Include features (erkély, terasz, kert, parkoló, garázs, lift, emelet, fűtés, állapot, kilátás) whenever they are mentioned as wanted, required, or excluded.
- property_types: apartment (lakás), house (ház, családi ház, ikerház, sorház), plot (telek), commercial (üzlethelyiség, iroda), other.
- Dates: resolve relative dates ("pénteken", "jövő héten kedden", "holnap", "három hónapon belül") using the "Day expressions" table and the calendar given in the request, in the Europe/Budapest time zone. Never calculate a weekday yourself: copy the date from the table ("kedden", "jövő kedden", "holnapután", "jövő héten" are all listed there). Output dates as YYYY-MM-DD and times as HH:MM (24-hour); "délelőtt 10" is 10:00, "délután 3" is 15:00. "Within three months" is a desired_move_date three months from today. Leave the time null unless a time is stated.
- tasks: concrete actions the agent committed to or must do ("küldjek megfelelő ingatlanokat", "hívjam vissza pénteken"). One task per action, with due_date when the text gives or implies one.
- follow_up_date / follow_up_time: the next time the agent should contact this client, if stated or clearly implied.
- promised_actions: what either side promised. decisions: what was agreed. open_questions: what is still unclear or must be clarified.
- important_dates: dated events such as viewings, contract dates or moving dates.
- interaction_type: call for phone calls, meeting for in-person meetings, viewing for property viewings, email for emails, note otherwise.`;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Budapest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", weekday: "long" });
const timeFormatter = new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", hour: "2-digit", minute: "2-digit" });

const DAY_MS = 86_400_000;
const WEEKDAYS = ["hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton", "vasárnap"];

/** Today's Budapest calendar date as a UTC-noon Date, safe to add whole days to across DST changes. */
function budapestDay(now: Date) {
  const [y, m, d] = dateFormatter.format(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

/** The next 14 days with Hungarian weekday names, so the model looks dates up instead of computing them. */
function calendar(now: Date) {
  const today = budapestDay(now);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = plus(today, i);
    const label = i === 0 ? " (ma)" : i === 1 ? " (holnap)" : "";
    days.push(`${iso(d)} ${weekdayFormatter.format(d)}${label}`);
  }
  return days.join("\n");
}

/**
 * Hungarian day expressions resolved in code, so the model never has to
 * interpret them: "kedden" is the next Tuesday after today, "jövő kedden"
 * the Tuesday of next calendar week.
 */
export function relativeDayTable(now: Date) {
  const today = budapestDay(now);
  const dow = (today.getUTCDay() + 6) % 7; // 0 = Monday
  const nextMonday = plus(today, 7 - dow);
  const lines = [`ma = ${iso(today)}`, `holnap = ${iso(plus(today, 1))}`, `holnapután = ${iso(plus(today, 2))}`];
  WEEKDAYS.forEach((name, w) => {
    const ahead = ((w - dow + 7) % 7) || 7;
    lines.push(`${name} = ${iso(plus(today, ahead))}; jövő ${name} = ${iso(plus(nextMonday, w))}`);
  });
  lines.push(`ezen a héten = ${iso(today)} – ${iso(plus(nextMonday, -1))}`);
  lines.push(`jövő héten = ${iso(nextMonday)} – ${iso(plus(nextMonday, 6))} (if no day is given, use ${iso(nextMonday)})`);
  lines.push(`hétvégén = ${iso(plus(today, ((5 - dow + 7) % 7) || 7))}`);
  return lines.join("\n");
}

export type CaptureHint = "email" | "portal";

const HINTS: Record<CaptureHint, string> = {
  email: "The note is an email. The client is the other party of the email (the sender of an incoming email, the recipient of an outgoing one), not the agent. Use interaction_type email.",
  portal:
    "The note is an inquiry email forwarded by a property portal. The client is the person who made the inquiry: take their name, phone and email from the message body, never the portal's own address or name. Use interaction_type email. Mention the listing they asked about in the summary. The listing's own attributes (its location, type, size, rooms, price) are not the inquirer's requirements: fill requirements only from what the inquirer writes they want or can afford.",
};

export function captureUserPrompt(text: string, now: Date, knownClientName?: string | null, hint?: CaptureHint | null) {
  const context = [
    `Current date: ${dateFormatter.format(now)} (${weekdayFormatter.format(now)}), time ${timeFormatter.format(now)}, Europe/Budapest.`,
    `Calendar:\n${calendar(now)}`,
    `Day expressions, already resolved (use these dates exactly, do not reinterpret):\n${relativeDayTable(now)}`,
    knownClientName ? `The agent recorded this from the page of client "${knownClientName}".` : null,
    hint ? HINTS[hint] : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `${context}\n\n<note>\n${text}\n</note>`;
}
