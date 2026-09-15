import {
  isClerkSpokenReference,
  normalizeReferenceNumber,
} from "../guard/refnum";
import type { OutcomeKind, OutcomeResult, TranscriptEntry } from "../types";

/** Pick the outcome card fields. Never invent a complaint number. */
export function decideCallOutcome(args: {
  pinnedReferenceNumber: string | null;
  pinnedAnswer?: string | null;
  transcript: TranscriptEntry[];
  refused: boolean;
  outcomeKind?: OutcomeKind;
  emergency?: boolean;
}): {
  result: OutcomeResult;
  referenceNumber: string | null;
  capturedAnswer: string | null;
} {
  // Only keep a pin the clerk actually said — never an LLM/user invention.
  const rawPin = args.pinnedReferenceNumber?.trim() || null;
  const pin =
    rawPin && isClerkSpokenReference(rawPin, args.transcript)
      ? normalizeReferenceNumber(rawPin)
      : null;
  const answer = args.pinnedAnswer?.trim() || null;

  if (args.refused) {
    return { result: "refused", referenceNumber: pin, capturedAnswer: answer };
  }

  if (pin) {
    return { result: "resolved", referenceNumber: pin, capturedAnswer: answer };
  }

  if (answer) {
    return { result: "answered", referenceNumber: null, capturedAnswer: answer };
  }

  const clerkSpoke = args.transcript.some(
    (entry) => entry.side === "clerk" && (entry.source === "stt" || entry.source === "system")
  );
  const weSpoke = args.transcript.some(
    (entry) => entry.side === "us" && (entry.source === "tts-sent" || entry.source === "user-voice")
  );

  if (!clerkSpoke) {
    return { result: "no-answer", referenceNumber: null, capturedAnswer: null };
  }

  if (args.emergency && weSpoke) {
    return {
      result: "resolved",
      referenceNumber: null,
      capturedAnswer: "Help dispatched",
    };
  }

  if (args.outcomeKind === "acknowledged" && weSpoke) {
    return {
      result: "answered",
      referenceNumber: null,
      capturedAnswer: answer,
    };
  }

  return { result: "incomplete", referenceNumber: null, capturedAnswer: null };
}
