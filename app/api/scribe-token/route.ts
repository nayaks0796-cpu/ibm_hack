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
    "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
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

  const data = (await res.json()) as
    | string
    | { token?: string; single_use_token?: string };
  const token =
    typeof data === "string"
      ? data
      : data.token ?? data.single_use_token ?? "";

  if (!token) {
    return NextResponse.json(
      { error: "ElevenLabs did not return a Scribe token" },
      { status: 502 }
    );
  }

  return NextResponse.json({ token });
}
