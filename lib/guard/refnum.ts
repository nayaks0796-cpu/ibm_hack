// Reference-number detector — complaint / ticket / reference numbers in captions.
// Tight letter+digit forms: COMP-4821, TICK123456.
// Standalone 6–13 digit numbers only after complaint/शिकायत/reference/ticket/registration.
// Complaint numbers come ONLY from clerk speech — never invent them on our side.

import type { TranscriptEntry } from "../types";

const GLUED = /\b[A-Za-z]{2,6}\d{4,12}\b/g;
const SEPARATED = /\b[A-Za-z]{2,6}[-/]\d{4,12}\b/g;
const KEYWORD =
  /(?:complaint|शिकायत|reference|ticket|registration|संदर्भ|पंजीकरण)/i;
const KEYWORD_DIGITS =
  /(?:complaint|शिकायत|reference|ticket|registration|संदर्भ|पंजीकरण)\D{0,20}(\d{6,13})/gi;
const KEYWORD_SPACED = /\b[A-Za-z]{2,6}\s+\d{4,12}\b/g;

export function normalizeReferenceNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function detectReferenceNumbers(text: string): string[] {
  const seen = new Set<string>();

  GLUED.lastIndex = 0;
  SEPARATED.lastIndex = 0;
  for (const match of text.matchAll(SEPARATED)) {
    seen.add(normalizeReferenceNumber(match[0]));
  }
  for (const match of text.matchAll(GLUED)) {
    seen.add(normalizeReferenceNumber(match[0]));
  }

  if (KEYWORD.test(text)) {
    KEYWORD.lastIndex = 0;
    KEYWORD_DIGITS.lastIndex = 0;
    KEYWORD_SPACED.lastIndex = 0;
    for (const match of text.matchAll(KEYWORD_DIGITS)) {
      if (match[1]) seen.add(match[1]);
    }
    for (const match of text.matchAll(KEYWORD_SPACED)) {
      seen.add(normalizeReferenceNumber(match[0]));
    }
  }

  return [...seen];
}

/** Reference numbers that appeared in clerk captions only. */
export function clerkSpokenReferenceNumbers(
  transcript: TranscriptEntry[]
): string[] {
  const seen = new Set<string>();
  for (const entry of transcript) {
    if (entry.side !== "clerk") continue;
    if (entry.source !== "stt" && entry.source !== "system") continue;
    for (const ref of detectReferenceNumbers(entry.text)) {
      seen.add(ref);
    }
  }
  return [...seen];
}

/** True only if this value was literally heard from the clerk. */
export function isClerkSpokenReference(
  value: string | null | undefined,
  transcript: TranscriptEntry[]
): boolean {
  const pin = value?.trim();
  if (!pin) return false;
  const normalized = normalizeReferenceNumber(pin);
  return clerkSpokenReferenceNumbers(transcript).includes(normalized);
}
