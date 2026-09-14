// AudioTransport interface — ALL audio in/out goes through here.
// No component or screen may touch a mic, speaker, or phone API directly.

export interface AudioTransport {
  /** Start capturing inbound audio (clerk side). */
  startInbound(): Promise<void>;
  /** Stop capturing inbound audio. */
  stopInbound(): void;
  /** Speak text via TTS. Returns a cancel function for barge-in. */
  speak(text: string, lang: "hi" | "en", voice?: string): Promise<() => void>;
  /** Stop outbound TTS immediately (unmute barge-in). */
  stopSpeaking(): void;
  /** Send a DTMF tone character. */
  sendDTMF(key: string): void;
  /** Subscribe to line-state changes for SilenceRing. */
  onLineState(cb: (state: "active" | "silent" | "disconnected") => void): () => void;
  /** Subscribe to inbound PCM16 @ 16 kHz chunks. Transport owns the mic. */
  onInboundAudio(cb: (pcm16: ArrayBuffer) => void): () => void;
}
