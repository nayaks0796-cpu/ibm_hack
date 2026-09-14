// POST /api/scribe-token
// Returns a short-lived ElevenLabs Scribe token. Never exposes the API key to the browser.
import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const res = await fetch(
    "https://api.elevenlabs.io/v1/convai/conversation/token",
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `ElevenLabs error: ${text}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json({ token: data.token ?? data.signed_url ?? data });
}
