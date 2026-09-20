// POST /api/scribe-token
// Returns a short-lived ElevenLabs Scribe token. Never exposes the API key to the browser.
import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured", kind: "auth" },
      { status: 500 }
    );
  }

  let res = await createRealtimeScribeToken(apiKey);
  if (res.status === 429 || res.status >= 500) {
    await sleep(800);
    res = await createRealtimeScribeToken(apiKey);
  }

  if (!res.ok) {
    const text = await res.text();
    console.warn("[scribe-token]", res.status, text.slice(0, 300));
    return NextResponse.json(
      { error: `ElevenLabs error: ${text}`, kind: tokenFailKind(res.status) },
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
      { error: "ElevenLabs did not return a Scribe token", kind: "error" },
      { status: 502 }
    );
  }

  return NextResponse.json({ token });
}

function createRealtimeScribeToken(apiKey: string): Promise<Response> {
  return fetch(
    "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );
}

function tokenFailKind(status: number): "quota" | "busy" | "auth" | "error" {
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "quota";
  if (status === 429 || status >= 500) return "busy";
  return "error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
