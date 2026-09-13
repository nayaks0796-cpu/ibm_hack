// POST /api/scribe-token
// Returns a short-lived ElevenLabs Scribe token. Never exposes the API key to the browser.
import { NextResponse } from "next/server";

export async function POST() {
  // TODO: step 4 — exchange ELEVENLABS_API_KEY for a short-lived Scribe token
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
