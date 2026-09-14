// Auto-switch logic: uses ElevenLabs Scribe by default; switches to Watson STT
// when Scribe returns a quota/credit error — no page reload required.
// Both engines emit the same CaptionCallback shape so CaptionFeed is unaware.
// bob: watson stt fallback

export type { CaptionCallback } from "./client";
import { ScribeClient } from "../elevenlabs/scribe";
import { WatsonSTTClient } from "./client";
import type { CaptionCallback } from "./client";

type CallLanguage = "hi" | "en";

/**
 * Returns a unified STT controller that:
 * 1. Starts ElevenLabs Scribe.
 * 2. On quota/credit error, silently switches to Watson STT.
 * 3. Calls onBackup() when the switch happens (so the UI can show the banner).
 */
export function createSTTWithFallback(
  lang: CallLanguage,
  onCaption: CaptionCallback,
  onBackup: () => void
) {
  const watsonLang =
    lang === "hi" ? "hi-IN_Telephony" : "en-IN_Telephony";

  const scribe = new ScribeClient();
  const watson = new WatsonSTTClient();
  let usingBackup = false;

  const switchToWatson = async () => {
    if (usingBackup) return;
    usingBackup = true;
    scribe.disconnect();
    onBackup();
    try {
      await watson.connect(watsonLang, onCaption);
    } catch (err) {
      console.error("[STT] Watson backup connect failed:", err);
    }
  };

  const connect = async (token: string) => {
    try {
      await scribe.connect(token, onCaption);
    } catch (err: unknown) {
      // Detect quota/credit error from ElevenLabs.
      const msg = String(err).toLowerCase();
      if (
        msg.includes("quota") ||
        msg.includes("credit") ||
        msg.includes("insufficient") ||
        msg.includes("429")
      ) {
        await switchToWatson();
      } else {
        throw err;
      }
    }
  };

  const disconnect = () => {
    scribe.disconnect();
    watson.disconnect();
  };

  /** Forward audio to whichever engine is active (Watson needs raw audio pushed). */
  const sendAudio = (chunk: ArrayBuffer | Blob) => {
    if (usingBackup) {
      watson.sendAudio(chunk);
    }
    // Scribe receives audio via its own WebSocket connection (handled internally).
  };

  return { connect, disconnect, sendAudio };
}
