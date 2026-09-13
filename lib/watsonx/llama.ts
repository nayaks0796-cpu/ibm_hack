// Llama 3.3 70B Instruct on IBM watsonx.ai
// Temperature ~0.2, JSON output only. Three exported functions:
//   suggest()      → reply suggestions for the live call screen
//   extractFacts() → pull reference numbers / facts from captions
//   gloss()        → ISL gloss array for the avatar
// TODO: step 6 — implement suggest(); step 9 — implement gloss()

import type { TranscriptEntry } from "../types";

export interface Suggestion {
  id: string;
  /** Short button label in UI language. */
  label: string;
  /** Exact sentence TTS will speak, in call language. */
  sentence: string;
}

export async function suggest(
  _caption: string,
  _history: TranscriptEntry[],
  _facts: Record<string, string>,
  _goal: string,
  _callLanguage: "hi" | "en"
): Promise<Suggestion[]> {
  throw new Error("suggest() not implemented");
}

export async function extractFacts(
  _text: string
): Promise<Record<string, string>> {
  throw new Error("extractFacts() not implemented");
}

export async function gloss(_text: string): Promise<string[]> {
  throw new Error("gloss() not implemented");
}
