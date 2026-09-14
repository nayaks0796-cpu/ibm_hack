// localStorage / IndexedDB helpers for Sampark.
// All user data lives on-device. No accounts, no server-side database.

import { redact, redactTranscript } from "../guard/redact";
import type {
  AccessNeed,
  CallSession,
  Outcome,
  TranscriptEntry,
  UserProfile,
} from "../types";
import { defaultVoiceId, resolveVoiceId } from "../voices";

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
  voice: defaultVoiceId("hi"),
  islAvatar: true,
  accessNeed: "both",
};

function resolveAccessNeed(value: unknown): AccessNeed {
  if (value === "hearing" || value === "speech" || value === "both") {
    return value;
  }
  return DEFAULT_PROFILE.accessNeed;
}

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

/** Merge playbook facts into remembered facts (used after the call, if the user opts in). */
export function mergeSavedFacts(partial: Record<string, string>): void {
  const next = { ...loadFacts() };
  for (const [key, value] of Object.entries(partial)) {
    const trimmed = value.trim();
    if (trimmed) next[key] = trimmed;
  }
  saveFacts(next);
}

/** Pick only the keys a playbook needs, prefilled from remembered facts when present. */
export function factsForPlaybook(
  playbookKeys: string[],
  source: Record<string, string> = loadFacts()
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of playbookKeys) {
    out[key] = (source[key] ?? "").trim();
  }
  return out;
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): UserProfile {
  const stored = readJson<Partial<UserProfile>>(localStorage, PROFILE_KEY, {});
  const merged = { ...DEFAULT_PROFILE, ...stored };
  const callLanguage = merged.callLanguage === "en" ? "en" : "hi";
  return {
    ...merged,
    callLanguage,
    voice: resolveVoiceId(stored.voice, callLanguage),
    accessNeed: resolveAccessNeed(stored.accessNeed),
  };
}

export function hasCompletedSetup(): boolean {
  return loadProfile().name.trim().length > 0;
}

export function saveOutcome(outcome: Outcome): void {
  const safe: Outcome = {
    ...outcome,
    facts: outcome.facts ?? {},
    transcript: redactTranscript(outcome.transcript),
  };
  const existing = loadOutcomes();
  existing.push(safe);
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify(existing));
  sessionStorage.setItem(LAST_OUTCOME_KEY, JSON.stringify(safe));
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
