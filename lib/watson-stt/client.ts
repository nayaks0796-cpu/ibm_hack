// Watson STT backup client — hi-IN_Telephony / en-IN_Telephony models.
// Connects via WebSocket to /api/stt-fallback which proxies to IBM Watson STT.
// Emits the same CaptionCallback shape as ScribeClient so CaptionFeed cannot
// tell which engine is active.
// bob: watson stt fallback

export type CaptionCallback = (text: string, isFinal: boolean) => void;

export class WatsonSTTClient {
  private ws: WebSocket | null = null;

  async connect(
    lang: "hi-IN_Telephony" | "en-IN_Telephony",
    onCaption: CaptionCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/stt-fallback?model=${lang}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => resolve();

      this.ws.onerror = (ev) => reject(new Error(`Watson STT WebSocket error: ${ev}`));

      this.ws.onmessage = (event) => {
        try {
          // Watson STT sends { results: [{ alternatives: [{ transcript, confidence }], final: bool }] }
          const data = JSON.parse(event.data as string) as {
            results?: Array<{
              alternatives?: Array<{ transcript: string }>;
              final?: boolean;
            }>;
          };
          const result = data.results?.[0];
          if (!result) return;
          const text = result.alternatives?.[0]?.transcript?.trim() ?? "";
          if (!text) return;
          onCaption(text, result.final ?? false);
        } catch {
          // Non-JSON frames (e.g. Watson status messages) — ignore.
        }
      };
    });
  }

  /** Send a raw audio chunk to the Watson STT proxy. */
  sendAudio(chunk: ArrayBuffer | Blob): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
