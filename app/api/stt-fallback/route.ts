// WS /api/stt-fallback
// Watson STT WebSocket proxy. Upgrades HTTP → WS, then opens a connection to
// IBM Watson STT and pipes audio frames in / transcript frames out.
// Emits the same message shape as the ElevenLabs Scribe client so CaptionFeed
// cannot tell which engine is active.
//
// Next.js App Router does not support WS upgrades natively.
// This route is handled by the custom server in server.js which intercepts the
// upgrade event before handing remaining requests to Next.js.
//
// This file is kept as documentation / type reference.
// The actual WebSocket logic lives in server.js at the repo root.

export function GET() {
  return new Response(
    "WebSocket endpoint — upgrade handled by custom server (server.js)",
    { status: 426, headers: { Upgrade: "websocket" } }
  );
}
