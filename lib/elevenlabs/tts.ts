// ElevenLabs TTS client — server proxy only, never calls ElevenLabs directly from the browser.
// Model: eleven_flash_v2_5 (or eleven_multilingual_v2 if latency allows).
// Pass a catalog voice id from lib/voices.ts; the server resolves it to an ElevenLabs UUID.
// Callers pass AbortSignal so Unmute can cancel the fetch mid-stream (barge-in).

export async function fetchTts(
  text: string,
  lang: "hi" | "en",
  signal: AbortSignal,
  voice?: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch("/api/tts", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang, voice }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`TTS request failed: ${err}`);
  }

  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    throw new Error("TTS request failed: expected audio");
  }

  return res.body;
}

/** Stream chunks to a callback. Returns a cancel function for barge-in. */
export async function streamTTS(
  text: string,
  lang: "hi" | "en",
  onChunk: (chunk: Uint8Array) => void,
  voice?: string
): Promise<() => void> {
  const controller = new AbortController();
  const body = await fetchTts(text, lang, controller.signal, voice);
  const reader = body.getReader();

  void (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) onChunk(value);
      }
    } catch {
      // AbortError is expected on barge-in — ignore silently.
    }
  })();

  return () => {
    controller.abort();
    void reader.cancel();
  };
}
