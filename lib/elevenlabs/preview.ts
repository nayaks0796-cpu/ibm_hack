// One-shot voice sample for setup (not the live-call transport path).
// Prefer the catalog's public ElevenLabs previewUrl so Play works without TTS credits.

import { getVoice } from "../voices";
import { fetchTts } from "./tts";

const DEMO_LINES = {
  hi: "नमस्ते, मैं संपर्क के ज़रिए बात कर रहा हूँ।",
  en: "Hello, I am speaking through Sampark.",
} as const;

export type PreviewHandle = {
  stop: () => void;
  done: Promise<void>;
};

function playAudioElement(
  audio: HTMLAudioElement,
  signal: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const onAbort = () => {
      cleanup();
      resolve();
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Preview playback failed"));
    };
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      audio.onended = null;
      audio.onerror = null;
    };

    signal.addEventListener("abort", onAbort);
    audio.onended = onEnded;
    audio.onerror = onError;
    void audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

async function playFromUrl(
  url: string,
  signal: AbortSignal,
  assign: (audio: HTMLAudioElement) => void
): Promise<void> {
  const audio = new Audio(url);
  assign(audio);
  await playAudioElement(audio, signal);
}

async function playFromTts(
  voiceId: string,
  lang: "hi" | "en",
  signal: AbortSignal,
  assign: (audio: HTMLAudioElement, objectUrl: string) => void
): Promise<void> {
  const body = await fetchTts(DEMO_LINES[lang], lang, signal, voiceId);
  if (signal.aborted) return;

  const parts: Uint8Array[] = [];
  const reader = body.getReader();
  try {
    while (true) {
      if (signal.aborted) return;
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      if (value) parts.push(value);
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }

  if (signal.aborted || parts.length === 0) return;

  const copy = parts.map((part) => {
    const bytes = new Uint8Array(part.byteLength);
    bytes.set(part);
    return bytes;
  });
  const blob = new Blob(copy, { type: "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  assign(audio, objectUrl);
  try {
    await playAudioElement(audio, signal);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Play a short sample for a catalog voice. Call stop() to cancel. */
export function previewVoice(
  voiceId: string,
  lang: "hi" | "en"
): PreviewHandle {
  const abort = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let stopped = false;

  const stop = () => {
    stopped = true;
    abort.abort();
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  const done = (async () => {
    try {
      const previewUrl = getVoice(voiceId)?.previewUrl?.trim();
      if (previewUrl) {
        await playFromUrl(previewUrl, abort.signal, (el) => {
          audio = el;
        });
        return;
      }

      await playFromTts(voiceId, lang, abort.signal, (el, url) => {
        audio = el;
        objectUrl = url;
      });
    } catch (error) {
      if (abort.signal.aborted || stopped) return;
      throw error;
    } finally {
      audio = null;
      objectUrl = null;
    }
  })();

  return { stop, done };
}
