// Shared TypeScript types used across the Setu codebase.
// Keep in sync with the JSON shapes in AGENTS.md.

export type CallLanguage = "hi" | "en";

export type TranscriptSide = "clerk" | "us";
export type TranscriptSource = "stt" | "tts-sent" | "user-voice" | "dtmf" | "system";

export interface TranscriptEntry {
  /** Unix timestamp in milliseconds. */
  t: number;
  side: TranscriptSide;
  source: TranscriptSource;
  text: string;
  /** True if digits have been replaced with •••• for display. */
  redacted: boolean;
}

export type OutcomeResult = "resolved" | "refused" | "no-answer" | "incomplete";

export interface Outcome {
  playbookId: string;
  startedAt: number;
  endedAt: number;
  result: OutcomeResult;
  referenceNumber: string | null;
  transcript: TranscriptEntry[];
}

export interface PlaybookFact {
  key: string;
  label: Record<string, string>;
  required: boolean;
}

export interface Playbook {
  id: string;
  icon: string;
  title: Record<string, string>;
  goal: Record<string, string>;
  defaultCallLanguage: CallLanguage;
  facts: PlaybookFact[];
}
