// ElevenLabs TTS client — server proxy only, never calls ElevenLabs directly from the browser.
// Model: eleven_flash_v2_5 (or eleven_multilingual_v2 if latency allows).
// One voice speaks both Hindi and English.
// TODO: step 5 — implement streaming fetch to /api/tts + barge-in cancel

export async function streamTTS(
  _text: string,
  _lang: "hi" | "en",
  _onChunk: (chunk: Uint8Array) => void
): Promise<() => void> {
  throw new Error("streamTTS not implemented");
}
