// RoomTransport — demo transport using browser mic/speaker.
// Speak goes through /api/tts first, then browser speechSynthesis.
import type { AudioTransport } from "./AudioTransport";

type LineState = "active" | "silent" | "disconnected";

export class RoomTransport implements AudioTransport {
  private lineState: LineState = "disconnected";
  private listeners = new Set<(state: LineState) => void>();
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  lastSpeakSource: "eleven" | "demo" = "demo";

  async startInbound(): Promise<void> {
    this.setLineState("active");
  }

  stopInbound(): void {
    this.cancelSpeech();
    this.setLineState("disconnected");
  }

  async speak(text: string, lang: "hi" | "en"): Promise<() => void> {
    this.cancelSpeech();

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok || !res.body) {
        throw new Error("tts unavailable");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.audio = audio;
      this.objectUrl = url;
      this.lastSpeakSource = "eleven";
      await audio.play();
    } catch {
      this.lastSpeakSource = "demo";
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    }

    return () => this.cancelSpeech();
  }

  sendDTMF(_key: string): void {
    // Tones are step 10. Skeleton only records the key in the transcript.
  }

  onLineState(cb: (state: LineState) => void): () => void {
    this.listeners.add(cb);
    cb(this.lineState);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private cancelSpeech(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private setLineState(state: LineState): void {
    this.lineState = state;
    this.listeners.forEach((cb) => cb(state));
  }
}
