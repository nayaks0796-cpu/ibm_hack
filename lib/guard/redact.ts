// Redaction — digits after OTP/PIN/CVV/password become •••• in stored transcripts.
import type { TranscriptEntry } from "../types";
import { SENSITIVE_TRIGGER } from "./otp";

const REDACT_PATTERN = new RegExp(
  `((?:${SENSITIVE_TRIGGER})[\\s\\S]{0,40}?)(\\d{3,})`,
  "gi"
);

export function redact(text: string): string {
  REDACT_PATTERN.lastIndex = 0;
  return text.replace(REDACT_PATTERN, (_full, prefix: string) => `${prefix}••••`);
}

export function redactTranscript(entries: TranscriptEntry[]): TranscriptEntry[] {
  return entries.map((entry) => {
    const text = redact(entry.text);
    return {
      ...entry,
      text,
      redacted: entry.redacted || text !== entry.text,
    };
  });
}
