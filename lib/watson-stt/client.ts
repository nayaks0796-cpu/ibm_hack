// Watson STT backup client — hi-IN_Telephony / en-IN_Telephony.
// Connects to /api/stt-fallback (custom server.js WebSocket proxy).
// Same CaptionCallback as Scribe so the caption feed cannot tell which engine is on.
// bob: watson stt fallback

export type CaptionCallback = (text: string, isFinal: boolean) => void;

export class WatsonSTTClient {
  private ws: WebSocket | null = null;
  private queue: ArrayBuffer[] = [];

  async connect(
    lang: "hi-IN_Telephony" | "en-IN_Telephony",
    onCaption: CaptionCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/stt-fallback?model=${lang}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };

      const timer = window.setTimeout(() => {
        finish(new Error("Watson STT connect timeout"));
      }, 8000);

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        window.clearTimeout(timer);
        this.flushQueue();
        finish();
      };

      ws.onerror = () => {
        window.clearTimeout(timer);
        finish(new Error("Watson STT WebSocket error"));
      };

      ws.onclose = (event) => {
        if (!settled) {
          window.clearTimeout(timer);
          finish(
            new Error(`Watson STT closed: ${event.code} ${event.reason}`)
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            results?: Array<{
              alternatives?: Array<{ transcript: string }>;
              final?: boolean;
            }>;
            error?: string;
          };
          if (data.error) {
            finish(new Error(data.error));
            return;
          }
          const result = data.results?.[0];
          if (!result) return;
          const text = result.alternatives?.[0]?.transcript?.trim() ?? "";
          if (!text) return;
          onCaption(text, result.final ?? false);
        } catch {
          // Non-JSON frames — ignore.
        }
      };
    });
  }

  sendAudio(chunk: ArrayBuffer | Blob): void {
    const send = (buffer: ArrayBuffer) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(buffer);
        return;
      }
      if (this.queue.length < 40) this.queue.push(buffer);
    };

    if (chunk instanceof Blob) {
      void chunk.arrayBuffer().then(send);
      return;
    }
    send(chunk);
  }

  disconnect(): void {
    this.queue = [];
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
    }
    this.ws = null;
  }

  private flushQueue(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    for (const buffer of this.queue) this.ws.send(buffer);
    this.queue = [];
  }
}
