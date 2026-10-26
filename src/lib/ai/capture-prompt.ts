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
- Dates: resolve relative dates ("pénteken", "jövő héten kedden", "holnap", "három hónapon belül") using the calendar given in the request, in the Europe/Budapest time zone. Never calculate a weekday yourself: look the day up in the calendar. A weekday name means its next occurrence after today ("pénteken" on a Monday is the Friday of the same week; "jövő pénteken" is the Friday after that). Output dates as YYYY-MM-DD and times as HH:MM (24-hour); "délelőtt 10" is 10:00, "délután 3" is 15:00. "Within three months" is a desired_move_date three months from today. Leave the time null unless a time is stated.
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

/** The next 14 days with Hungarian weekday names, so the model looks dates up instead of computing them. */
function calendar(now: Date) {
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const label = i === 0 ? " (ma)" : i === 1 ? " (holnap)" : "";
    days.push(`${dateFormatter.format(d)} ${weekdayFormatter.format(d)}${label}`);
  }
  return days.join("\n");
}

export function captureUserPrompt(text: string, now: Date, knownClientName?: string | null) {
  const context = [
    `Current date: ${dateFormatter.format(now)} (${weekdayFormatter.format(now)}), time ${timeFormatter.format(now)}, Europe/Budapest.`,
    `Calendar (use it to resolve weekdays and relative dates):\n${calendar(now)}`,
    knownClientName ? `The agent recorded this from the page of client "${knownClientName}".` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `${context}\n\n<note>\n${text}\n</note>`;
}
