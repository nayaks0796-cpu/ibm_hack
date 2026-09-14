// POST /api/tts  body: { text: string, lang: "hi" | "en" }
// Streams audio from ElevenLabs TTS. Supports immediate cancellation (barge-in)
// via the client's AbortController — we abort the upstream fetch when our request aborts.
import { NextRequest } from "next/server";

// Single voice that handles both Hindi and English (eleven_flash_v2_5).
// Set ELEVENLABS_VOICE_ID in .env.local; falls back to a known multilingual voice.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_flash_v2_5";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { text, lang } = (await req.json()) as { text: string; lang: string };
  if (!text) {
    return new Response(
      JSON.stringify({ error: "text is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // AbortController shared between incoming request cancellation and upstream fetch.
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: "POST",
      signal: controller.signal,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        language_code: lang === "hi" ? "hi" : "en",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(
      JSON.stringify({ error: `ElevenLabs TTS error: ${errText}` }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } }
    );
  }

  // Pipe the upstream ReadableStream directly to the client.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-store",
    },
  });
}
