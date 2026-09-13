// POST /api/tts  body: { text: string, lang: "hi" | "en" }
// Streams audio from ElevenLabs TTS. Must support immediate cancellation (barge-in).
import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  // TODO: step 5 — proxy to ElevenLabs TTS with streaming + barge-in support
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
