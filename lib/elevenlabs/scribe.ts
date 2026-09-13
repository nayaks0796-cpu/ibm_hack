// ElevenLabs Scribe v2 Realtime client (browser, token-based).
// Connects with a short-lived token from /api/scribe-token.
// Emits TranscriptEntry objects; auto-switches to Watson backup on quota/credit error.
// Supports Hindi + English + mixed via keyterm prompting with user facts.
// TODO: step 4 — implement WebSocket connection to scribe_v2_realtime

export type ScribeCallback = (text: string, isFinal: boolean) => void;

export class ScribeClient {
  private ws: WebSocket | null = null;

  async connect(_token: string, _onCaption: ScribeCallback): Promise<void> {
    throw new Error("ScribeClient.connect not implemented");
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
