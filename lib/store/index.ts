// localStorage / IndexedDB helpers for Setu.
// All user data lives on-device. No accounts, no server-side database.
// Stores: user facts, call transcripts, outcome cards.
// TODO: step 2 — implement get/set for user facts; step 5 — transcript append; step 4 — outcome save

import type { Outcome, TranscriptEntry } from "../types";

const FACTS_KEY = "setu:facts";
const OUTCOMES_KEY = "setu:outcomes";

export function saveFacts(facts: Record<string, string>): void {
  localStorage.setItem(FACTS_KEY, JSON.stringify(facts));
}

export function loadFacts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FACTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveOutcome(outcome: Outcome): void {
  const existing = loadOutcomes();
  existing.push(outcome);
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify(existing));
}

export function loadOutcomes(): Outcome[] {
  try {
    return JSON.parse(localStorage.getItem(OUTCOMES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Append a single transcript entry to the in-progress call in sessionStorage. */
export function appendTranscriptEntry(entry: TranscriptEntry): void {
  const raw = sessionStorage.getItem("setu:transcript") ?? "[]";
  const entries: TranscriptEntry[] = JSON.parse(raw);
  entries.push(entry);
  sessionStorage.setItem("setu:transcript", JSON.stringify(entries));
}

export function loadCurrentTranscript(): TranscriptEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem("setu:transcript") ?? "[]");
  } catch {
    return [];
  }
}
