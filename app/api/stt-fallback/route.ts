// WS /api/stt-fallback
// Watson STT proxy. Emits the same message shape as the ElevenLabs Scribe client,
// so CaptionFeed cannot tell which engine is active.
// TODO: step 8 — implement WebSocket upgrade + Watson STT streaming proxy
export function GET() {
  // Next.js App Router does not natively support WebSocket upgrades yet.
  // Wire up via a custom server or edge runtime in step 8.
  return new Response("WebSocket endpoint — not yet implemented", {
    status: 501,
  });
}
