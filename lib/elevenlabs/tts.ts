// ElevenLabs TTS client — server proxy only, never calls ElevenLabs directly from the browser.
// Model: eleven_flash_v2_5 (or eleven_multilingual_v2 if latency allows).
// One voice speaks both Hindi and English.
// Returns a cancel function for barge-in: calling it aborts the fetch and stops playback.

export async function streamTTS(
  text: string,
  lang: "hi" | "en",
  onChunk: (chunk: Uint8Array) => void
): Promise<() => void> {
  const controller = new AbortController();

  const res = await fetch("/api/tts", {
    method: "POST",
    signal: controller.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`TTS request failed: ${err}`);
  }

  const reader = res.body.getReader();

  // Stream chunks asynchronously; callers can cancel mid-stream via the returned function.
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(value);
      }
    } catch {
      // AbortError is expected on barge-in — ignore silently.
    }
  })();

  return () => {
    controller.abort();
    reader.cancel().catch(() => {});
  };
}
