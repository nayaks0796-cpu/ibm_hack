// ElevenLabs Scribe v2 Realtime client (browser, token-based).
// Token comes from POST /api/scribe-token — never the API key.
// Audio is PCM16 @ 16 kHz from AudioTransport, not from getUserMedia here.

export type ScribeCallback = (text: string, isFinal: boolean) => void;

export type ScribeConnectOptions = {
  language?: "hi" | "en";
  keyterms?: string[];
  onError?: (error: Error) => void;
};

const SAMPLE_RATE = 16000;

export function keytermsFromFacts(
  name: string,
  facts: Record<string, string>
): string[] {
  const extras = ["complaint", "reference", "ticket", "शिकायत", "COMP"];
  const values = [name, ...Object.values(facts), ...extras]
    .map((value) => value.trim())
    .filter((value) => value.length > 1);
  return [...new Set(values)].slice(0, 20);
}

export class ScribeClient {
  private ws: WebSocket | null = null;
  private onError: ((error: Error) => void) | null = null;

  async connect(
    token: string,
    onCaption: ScribeCallback,
    options: ScribeConnectOptions = {}
  ): Promise<void> {
    this.disconnect();
    this.onError = options.onError ?? null;

    const language = options.language === "en" ? "en" : "hi";
    const params = new URLSearchParams({
      model_id: "scribe_v2_realtime",
      token,
      audio_format: "pcm_16000",
      commit_strategy: "vad",
      language_code: language,
      no_verbatim: "true",
      vad_silence_threshold_secs: "0.8",
    });
    params.append("secondary_languages", language === "hi" ? "en" : "hi");
    for (const term of options.keyterms ?? []) {
      params.append("keyterms", term.slice(0, 50));
    }

    const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };

      const timer = window.setTimeout(() => {
        finish(new Error("Scribe session_started timeout"));
      }, 8000);

      ws.onopen = () => {
        // Wait for session_started before sending audio.
      };

      ws.onerror = () => {
        finish(new Error("Scribe WebSocket error"));
      };

      ws.onclose = (event) => {
        if (!settled) {
          finish(new Error(`Scribe closed: ${event.code} ${event.reason}`));
        }
      };

      ws.onmessage = (event) => {
        let data: {
          message_type?: string;
          text?: string;
          error?: string;
        };
        try {
          data = JSON.parse(String(event.data));
        } catch {
          return;
        }

        const type = data.message_type ?? "";
        if (type === "session_started") {
          finish();
          return;
        }

        if (type === "partial_transcript") {
          const text = data.text?.trim();
          if (text) onCaption(text, false);
          return;
        }

        if (
          type === "committed_transcript" ||
          type === "committed_transcript_with_timestamps"
        ) {
          const text = data.text?.trim();
          if (text) onCaption(text, true);
          return;
        }

        if (isScribeFailure(type)) {
          const error = new Error(data.error || type);
          if (!settled) {
            finish(error);
            return;
          }
          this.onError?.(error);
        }
      };
    });
  }

  sendAudio(chunk: ArrayBuffer | Blob): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    const send = (buffer: ArrayBuffer) => {
      this.ws?.send(
        JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: bytesToBase64(new Uint8Array(buffer)),
          commit: false,
          sample_rate: SAMPLE_RATE,
        })
      );
    };

    if (chunk instanceof Blob) {
      void chunk.arrayBuffer().then(send);
      return;
    }
    send(chunk);
  }

  disconnect(): void {
    this.onError = null;
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
}

function isScribeFailure(type: string): boolean {
  return (
    type === "error" ||
    type === "auth_error" ||
    type === "quota_exceeded" ||
    type === "rate_limited" ||
    type === "resource_exhausted" ||
    type === "unaccepted_terms" ||
    type === "invalid_request" ||
    type === "session_time_limit_exceeded" ||
    type === "transcriber_error"
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}
