// Redaction — replaces digits in sensitive contexts with •••• in stored transcripts.
// Same trigger words as otp.ts; digits → •••• in stored text.
// TODO: step 7 — apply to TranscriptEntry before persisting

const REDACT_PATTERN =
  /((?:otp|ओटीपी|pin|पिन|cvv|password|पासवर्ड).{0,40}?)(\d{3,})/gi;

/**
 * Returns a copy of text with sensitive digit sequences replaced by ••••.
 */
export function redact(text: string): string {
  return text.replace(REDACT_PATTERN, (_m, prefix, _digits) => `${prefix}••••`);
}
