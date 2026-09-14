// localStorage / IndexedDB helpers for Setu.
// All user data lives on-device. No accounts, no server-side database.

import { redact } from "../guard/redact";
import type {
  CallSession,
  Outcome,
  TranscriptEntry,
  UserProfile,
} from "../types";

const FACTS_KEY = "setu:facts";
const OUTCOMES_KEY = "setu:outcomes";
const PROFILE_KEY = "setu:profile";
const TRANSCRIPT_KEY = "setu:transcript";
const SESSION_KEY = "setu:call";
const LAST_OUTCOME_KEY = "setu:lastOutcome";

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  uiLanguage: "en",
  callLanguage: "hi",
  voice: "demo",
  islAvatar: true,
};

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveFacts(facts: Record<string, string>): void {
  localStorage.setItem(FACTS_KEY, JSON.stringify(facts));
}

export function loadFacts(): Record<string, string> {
  return readJson(localStorage, FACTS_KEY, {});
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): UserProfile {
  const stored = readJson<Partial<UserProfile>>(localStorage, PROFILE_KEY, {});
  return { ...DEFAULT_PROFILE, ...stored, voice: "demo" };
}

export function hasCompletedSetup(): boolean {
  return loadProfile().name.trim().length > 0;
}

export function saveOutcome(outcome: Outcome): void {
  const existing = loadOutcomes();
  existing.push(outcome);
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify(existing));
  sessionStorage.setItem(LAST_OUTCOME_KEY, JSON.stringify(outcome));
}

export function loadOutcomes(): Outcome[] {
  return readJson(localStorage, OUTCOMES_KEY, []);
}

export function loadLastOutcome(): Outcome | null {
  const fromSession = readJson<Outcome | null>(sessionStorage, LAST_OUTCOME_KEY, null);
  if (fromSession) return fromSession;
  const all = loadOutcomes();
  return all.length > 0 ? all[all.length - 1] : null;
}

export function saveCallSession(session: CallSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadCallSession(): CallSession | null {
  return readJson<CallSession | null>(sessionStorage, SESSION_KEY, null);
}

export function clearCallSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TRANSCRIPT_KEY);
}

export function appendTranscriptEntry(entry: TranscriptEntry): void {
  const entries = loadCurrentTranscript();
  const text = redact(entry.text);
  entries.push({
    ...entry,
    text,
    redacted: text !== entry.text || entry.redacted,
  });
  sessionStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(entries));
}

export function loadCurrentTranscript(): TranscriptEntry[] {
  return readJson(sessionStorage, TRANSCRIPT_KEY, []);
}

export function clearCurrentTranscript(): void {
  sessionStorage.removeItem(TRANSCRIPT_KEY);
}
