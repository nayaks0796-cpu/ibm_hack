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

export type OutcomeResult =
  | "resolved"
  | "answered"
  | "refused"
  | "no-answer"
  | "incomplete";

export type OutcomeKind = "reference" | "answer" | "acknowledged";

export interface Outcome {
  playbookId: string;
  startedAt: number;
  endedAt: number;
  result: OutcomeResult;
  referenceNumber: string | null;
  /** Short clerk answer pinned by the user (lab result, bed yes/no, status). */
  capturedAnswer?: string | null;
  outcomeKind?: OutcomeKind;
  /** Playbook-scoped facts used on this call (for optional "save for next time"). */
  facts: Record<string, string>;
  transcript: TranscriptEntry[];
}

export type UiLanguage = "en" | "hi" | "ta" | "te" | "kn" | "ml" | "mr" | "bn";

/** Why the user needs the relay — drives the Introduce myself disclosure. */
export type AccessNeed = "hearing" | "speech" | "both";

export interface UserProfile {
  name: string;
  uiLanguage: UiLanguage;
  callLanguage: CallLanguage;
  /** Catalog id from lib/voices.ts (e.g. "hi-1", "en", "en-2"). */
  voice: string;
  islAvatar: boolean;
  accessNeed: AccessNeed;
  /** Area / landmark spoken in emergency openers. Optional. */
  location?: string;
}

export interface CallSession {
  playbookId: string;
  startedAt: number;
  callLanguage: CallLanguage;
  pinnedReferenceNumber: string | null;
  pinnedAnswer?: string | null;
  /** Facts for this call only — not auto-saved to remembered facts. */
  facts: Record<string, string>;
  /** Initial ISL preference for this call; can still toggle live. */
  islAvatar: boolean;
  /** Caller briefing for the autonomous AI relay agent. */
  userBrief?: string;
  /** Emergency SOS: speak the opener once without waiting for Send. */
  autoSpeakOpener?: boolean;
}

export interface ReplySuggestion {
  id: string;
  label: string;
  sentence: string;
  /** Default speak. IVR menu options send a tone instead of TTS. */
  action?: "speak" | "dtmf";
  digit?: string;
}

export interface PlaybookFact {
  key: string;
  label: Record<string, string>;
  required: boolean;
}

export type PlaybookCategory =
  | "emergency"
  | "utility"
  | "money"
  | "health"
  | "government"
  | "legal";

export type PlaybookChannel = "phone-human" | "phone-ivr" | "in-person";

/** Typical next steps for the LLM — not a transcript, not facts. */
export interface PlaybookStage {
  id: string;
  en: string;
  hi: string;
}

export interface QuickPhrase {
  id: string;
  label: Record<string, string>;
  sentence: Record<string, string>;
}

export interface Playbook {
  id: string;
  icon: string;
  title: Record<string, string>;
  goal: Record<string, string>;
  defaultCallLanguage: CallLanguage;
  facts: PlaybookFact[];
  category?: PlaybookCategory;
  channel?: PlaybookChannel;
  outcomeKind?: OutcomeKind;
  emergency?: boolean;
  keyterms?: string[];
  stages?: PlaybookStage[];
  quickPhrases?: QuickPhrase[];
}
