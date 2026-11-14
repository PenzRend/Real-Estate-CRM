/** Sent by the "Mondd Flaviónak" button on a phone: the assistant opens and starts listening. */
export const VOICE_EVENT = "flavio:voice";

// On a computer the menu's "Mondd Flaviónak" listens in place and hands what
// was said to the assistant, which works without opening its panel.

/** The words the menu button heard; the assistant answers them in the background. */
export const VOICE_ASK_EVENT = "flavio:voice-ask";
export type VoiceAsk = { text: string };

/** The assistant's reply to a VOICE_ASK_EVENT, for the menu button to show. */
export const VOICE_ANSWER_EVENT = "flavio:voice-answer";
export type VoiceAnswer = { ok: true; answer: string; href: string | null } | { ok: false; error: string };

/** Opens the assistant's panel, to read a long answer or approve a prepared step. */
export const OPEN_ASSISTANT_EVENT = "flavio:open-assistant";
