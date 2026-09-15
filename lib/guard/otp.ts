// OTP/PIN guard — blocks TTS from speaking sensitive codes.
// Trigger: digit sequence of 3+ within 40 chars after (case/lang-insensitive)
// OTP / ओटीपी / PIN / पिन / CVV / password / पासवर्ड.
// Blocked send shows: "Sampark will not speak codes. Unmute to say it yourself."

export const SENSITIVE_TRIGGER =
  "(?:\\b(?:otp|pin|cvv|password|aadhaar|aadhar)\\b|ओटीपी|पिन|पासवर्ड|आधार)";

const HAS_CODE = new RegExp(
  `${SENSITIVE_TRIGGER}[\\s\\S]{0,40}?(?:\\d{3,}|\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4})`,
  "i"
);

export function containsSensitiveCode(sentence: string): boolean {
  HAS_CODE.lastIndex = 0;
  return HAS_CODE.test(sentence);
}
