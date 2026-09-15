// POST /api/tts  body: { text: string, lang: "hi" | "en", voice?: string }
// Streams audio from ElevenLabs TTS. Supports immediate cancellation (barge-in)
// via the client's AbortController — we abort the upstream fetch when our request aborts.
import { NextRequest } from "next/server";
import { FALLBACK_ELEVENLABS_VOICE_ID, elevenLabsIdFor } from "@/lib/voices";

const MODEL_ID = "eleven_flash_v2_5";

function synthesize(
  apiKey: string,
  voiceId: string,
  text: string,
  lang: string,
  signal: AbortSignal
) {
  const params = new URLSearchParams({
    optimize_streaming_latency: "3",
    output_format: "mp3_44100_128",
  });
  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?${params}`,
    {
      method: "POST",
      signal,
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
}

function shouldFallbackVoice(status: number, errText: string) {
  return (
    status === 402 ||
    /voice_not_found|paid_plan_required|not_found/i.test(errText)
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { text, lang, voice } = (await req.json()) as {
    text: string;
    lang: string;
    voice?: string;
  };
  if (!text) {
    return new Response(
      JSON.stringify({ error: "text is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // AbortController shared between incoming request cancellation and upstream fetch.
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const voiceId = elevenLabsIdFor(voice ?? "", lang);
  let upstream = await synthesize(apiKey, voiceId, text, lang, controller.signal);

  if (!upstream.ok) {
    const errText = await upstream.text();
    if (
      voiceId !== FALLBACK_ELEVENLABS_VOICE_ID &&
      shouldFallbackVoice(upstream.status, errText)
    ) {
      upstream = await synthesize(
        apiKey,
        FALLBACK_ELEVENLABS_VOICE_ID,
        text,
        lang,
        controller.signal
      );
    } else {
      return new Response(
        JSON.stringify({ error: `ElevenLabs TTS error: ${errText}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }
  }

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
