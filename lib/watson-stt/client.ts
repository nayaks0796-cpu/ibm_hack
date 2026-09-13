// Watson STT backup client — hi-IN_Telephony / en-IN_Telephony models.
// Auto-switches from ElevenLabs Scribe when a quota/credit error is received.
// Emits the same callback shape as ScribeClient so CaptionFeed cannot tell which engine is on.
// Shows a "backup captions" note in the UI when active.
// TODO: step 8 — implement Watson STT WebSocket proxy via /api/stt-fallback

export type CaptionCallback = (text: string, isFinal: boolean) => void;

export class WatsonSTTClient {
  async connect(
    _lang: "hi-IN_Telephony" | "en-IN_Telephony",
    _onCaption: CaptionCallback
  ): Promise<void> {
    throw new Error("WatsonSTTClient.connect not implemented");
  }

  disconnect(): void {}
}
