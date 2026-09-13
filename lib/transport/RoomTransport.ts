// RoomTransport — demo transport using browser mic/speaker.
// Used for local development and demo. Phase 2 uses ExotelTransport.
// TODO: step 5 — implement mic capture + TTS playback via /api/tts
import type { AudioTransport } from "./AudioTransport";

export class RoomTransport implements AudioTransport {
  async startInbound(): Promise<void> {
    throw new Error("RoomTransport.startInbound not implemented");
  }
  stopInbound(): void {}
  async speak(_text: string, _lang: "hi" | "en"): Promise<() => void> {
    throw new Error("RoomTransport.speak not implemented");
  }
  sendDTMF(_key: string): void {}
  onLineState(
    _cb: (state: "active" | "silent" | "disconnected") => void
  ): () => void {
    return () => {};
  }
}
