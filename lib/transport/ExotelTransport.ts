// ExotelTransport — phase 2 transport using Exotel Connect API + AgentStream bidirectional WSS.
// Trial: verified numbers only. Stub — do not implement until step 13.
import type { AudioTransport } from "./AudioTransport";

export class ExotelTransport implements AudioTransport {
  async startInbound(): Promise<void> {
    throw new Error("ExotelTransport not yet implemented (phase 2)");
  }
  stopInbound(): void {}
  async speak(_text: string, _lang: "hi" | "en"): Promise<() => void> {
    throw new Error("ExotelTransport not yet implemented (phase 2)");
  }
  sendDTMF(_key: string): void {}
  onLineState(
    _cb: (state: "active" | "silent" | "disconnected") => void
  ): () => void {
    return () => {};
  }
}
