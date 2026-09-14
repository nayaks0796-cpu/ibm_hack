// Auto-switch: ElevenLabs Scribe first; Watson STT if Scribe hits quota, auth, or won't start.
// No page reload. Both engines call the same onCaption shape.
// bob: watson stt fallback

export type { CaptionCallback } from "./client";
import { ScribeClient } from "../elevenlabs/scribe";
import { WatsonSTTClient } from "./client";
import type { CaptionCallback } from "./client";

type CallLanguage = "hi" | "en";

export function isBackupError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("credit") ||
    msg.includes("insufficient") ||
    msg.includes("429") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("rate_limited") ||
    msg.includes("resource_exhausted") ||
    msg.includes("auth_error") ||
    msg.includes("unauthorized") ||
    msg.includes("not configured") ||
    msg.includes("scribe")
  );
}

export function createSTTWithFallback(
  lang: CallLanguage,
  onCaption: CaptionCallback,
  onBackup: () => void,
  keyterms: string[] = []
) {
  const watsonLang =
    lang === "hi" ? "hi-IN_Telephony" : "en-IN_Telephony";

  const scribe = new ScribeClient();
  const watson = new WatsonSTTClient();
  let usingBackup = false;

  const switchToWatson = async () => {
    if (usingBackup) return;
    scribe.disconnect();
    await watson.connect(watsonLang, onCaption);
    usingBackup = true;
    onBackup();
  };

  const connect = async (token: string | null) => {
    if (!token) {
      await switchToWatson();
      return;
    }
    try {
      await scribe.connect(token, onCaption, {
        language: lang,
        keyterms,
        onError: (err) => {
          if (isBackupError(err)) {
            void switchToWatson().catch(() => undefined);
          }
        },
      });
    } catch {
      await switchToWatson();
    }
  };

  const disconnect = () => {
    scribe.disconnect();
    watson.disconnect();
  };

  const sendAudio = (chunk: ArrayBuffer | Blob) => {
    if (usingBackup) {
      watson.sendAudio(chunk);
      return;
    }
    scribe.sendAudio(chunk);
  };

  return { connect, disconnect, sendAudio };
}
