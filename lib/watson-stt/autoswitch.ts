// Auto-switch logic: uses ElevenLabs Scribe by default; switches to Watson STT
// when Scribe returns a quota/credit error.
// Both engines emit the same CaptionCallback shape.
// TODO: step 8 — implement switch logic with error detection

export type { CaptionCallback } from "./client";

export function createSTTWithFallback() {
  // Returns an object with connect/disconnect that transparently switches engines.
  throw new Error("createSTTWithFallback not implemented");
}
