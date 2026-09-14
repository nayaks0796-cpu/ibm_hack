// Shared TypeScript types used across the Sampark codebase.
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

export type UiLanguage = "en" | "hi" | "ta" | "te" | "kn" | "ml" | "mr" | "bn";

export interface UserProfile {
  name: string;
  uiLanguage: UiLanguage;
  callLanguage: CallLanguage;
  voice: "demo";
  islAvatar: boolean;
}

export interface CallSession {
  playbookId: string;
  startedAt: number;
  callLanguage: CallLanguage;
  pinnedReferenceNumber: string | null;
}

export interface ReplySuggestion {
  id: string;
  label: string;
  sentence: string;
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
