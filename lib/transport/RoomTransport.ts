// RoomTransport — demo transport using browser mic/speaker.
// Skeleton: speechSynthesis for speak(); inbound audio is step 5.
import type { AudioTransport } from "./AudioTransport";

type LineState = "active" | "silent" | "disconnected";

export class RoomTransport implements AudioTransport {
  private lineState: LineState = "disconnected";
  private listeners = new Set<(state: LineState) => void>();

  async startInbound(): Promise<void> {
    this.setLineState("active");
  }

  stopInbound(): void {
    this.cancelSpeech();
    this.setLineState("disconnected");
  }

  async speak(text: string, lang: "hi" | "en"): Promise<() => void> {
    this.cancelSpeech();
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return () => {};
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);

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
  }

  private setLineState(state: LineState): void {
    this.lineState = state;
    this.listeners.forEach((cb) => cb(state));
  }
}
