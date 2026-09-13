// OTP/PIN guard — blocks TTS from speaking sensitive codes.
// Trigger: digit sequence of 3+ within 40 chars after OTP/ओटीपी/PIN/पिन/CVV/password/पासवर्ड
// When blocked, shows: "Setu will not speak codes. Unmute to say it yourself."
// TODO: step 7 — implement and wire into Send flow

const TRIGGER_PATTERN =
  /(?:otp|ओटीपी|pin|पिन|cvv|password|पासवर्ड).{0,40}?\d{3,}/i;

/**
 * Returns true if the sentence contains a sensitive code that must NOT be spoken via TTS.
 */
export function containsSensitiveCode(sentence: string): boolean {
  return TRIGGER_PATTERN.test(sentence);
}
