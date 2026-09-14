import type { OutcomeResult, TranscriptEntry } from "../types";

/** Pick the outcome card fields. Never invent a complaint number. */
export function decideCallOutcome(args: {
  pinnedReferenceNumber: string | null;
  transcript: TranscriptEntry[];
  refused: boolean;
}): { result: OutcomeResult; referenceNumber: string | null } {
  const pin = args.pinnedReferenceNumber?.trim() || null;

  if (args.refused) {
    return { result: "refused", referenceNumber: pin };
  }

  if (pin) {
    return { result: "resolved", referenceNumber: pin };
  }

  const clerkSpoke = args.transcript.some(
    (entry) => entry.side === "clerk" && (entry.source === "stt" || entry.source === "system")
  );
  if (!clerkSpoke) {
    return { result: "no-answer", referenceNumber: null };
  }

  return { result: "incomplete", referenceNumber: null };
}
