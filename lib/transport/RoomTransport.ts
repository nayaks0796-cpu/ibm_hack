// RoomTransport — demo transport using browser mic/speaker.
// Speak goes through /api/tts first, then browser speechSynthesis.
// Unmute calls stopSpeaking() so the TTS fetch and playback abort immediately.
// Inbound mic audio is PCM16 @ 16 kHz for Scribe / Watson. No screen may call getUserMedia.
import type { AudioTransport } from "./AudioTransport";
import { fetchTts } from "../elevenlabs/tts";
import { DTMF_MS, dtmfFrequencies } from "./dtmf";

type LineState = "active" | "silent" | "disconnected";

const TARGET_RATE = 16000;
const SILENCE_RMS = 250;
const SILENCE_MS = 1400;

export class RoomTransport implements AudioTransport {
  private lineState: LineState = "disconnected";
  private listeners = new Set<(state: LineState) => void>();
  private audioListeners = new Set<(pcm16: ArrayBuffer) => void>();
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private speaking = false;
  private silentSince: number | null = null;
  private abortSpeak: AbortController | null = null;
  private generation = 0;
  private dtmfContext: AudioContext | null = null;
  private dtmfPlaying = false;
  lastSpeakSource: "eleven" | "demo" = "demo";

  /** Ask for the mic during a user gesture (Call button) so /call can start inbound. */
  static async requestMicAccess(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia(micConstraints());
    stream.getTracks().forEach((track) => track.stop());
  }

  async startInbound(): Promise<void> {
    if (this.stream) {
      this.setLineState("active");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("microphone unavailable");
    }

    const stream = await navigator.mediaDevices.getUserMedia(micConstraints());
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioCtx();
    if (context.state === "suspended") {
      await context.resume().catch(() => undefined);
    }

    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const mute = context.createGain();
    mute.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (this.speaking || this.dtmfPlaying || this.audioListeners.size === 0) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = downsampleToPcm16(input, context.sampleRate, TARGET_RATE);
      this.updateSilence(pcm);
      const copy = new Int16Array(pcm);
      this.audioListeners.forEach((cb) => cb(copy.buffer));
    };

    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);

    this.stream = stream;
    this.context = context;
    this.source = source;
    this.processor = processor;
    this.silentSince = null;
    this.setLineState("active");
  }

  stopInbound(): void {
    this.stopSpeaking();
    this.processor?.disconnect();
    this.source?.disconnect();
    void this.context?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.processor = null;
    this.source = null;
    this.context = null;
    this.stream = null;
    this.silentSince = null;
    this.dtmfPlaying = false;
    void this.dtmfContext?.close();
    this.dtmfContext = null;
    this.setLineState("disconnected");
  }

  stopSpeaking(): void {
    this.generation += 1;
    this.abortSpeak?.abort();
    this.abortSpeak = null;
    this.stopPlayback();
  }

  async speak(text: string, lang: "hi" | "en", voice?: string): Promise<() => void> {
    this.stopSpeaking();
    const generation = this.generation;
    const abort = new AbortController();
    this.abortSpeak = abort;
    this.speaking = true;

    const cancel = () => {
      if (this.generation === generation) this.stopSpeaking();
    };

    try {
      const body = await fetchTts(text, lang, abort.signal, voice);
      if (this.generation !== generation || abort.signal.aborted) {
        this.speaking = false;
        return cancel;
      }
      await this.playMpegBlob(body, generation, abort.signal);
      if (this.generation !== generation || abort.signal.aborted) {
        this.speaking = false;
        return cancel;
      }
      this.lastSpeakSource = "eleven";
    } catch {
      if (this.generation !== generation || abort.signal.aborted) {
        this.speaking = false;
        return cancel;
      }
      this.lastSpeakSource = "demo";
      this.speakDemo(text, lang, generation);
    }

    return cancel;
  }

  sendDTMF(key: string): void {
    const freqs = dtmfFrequencies(key);
    if (!freqs) return;
    void this.playDtmf(freqs);
  }

  onLineState(cb: (state: LineState) => void): () => void {
    this.listeners.add(cb);
    cb(this.lineState);
    return () => {
      this.listeners.delete(cb);
    };
  }

  onInboundAudio(cb: (pcm16: ArrayBuffer) => void): () => void {
    this.audioListeners.add(cb);
    return () => {
      this.audioListeners.delete(cb);
    };
  }

  private async playDtmf(freqs: [number, number]): Promise<void> {
    if (typeof window === "undefined") return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = this.context ?? this.dtmfContext ?? new AudioCtx();
    if (!this.context) this.dtmfContext = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined);
    }

    this.dtmfPlaying = true;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.value = freqs[0];
    osc2.frequency.value = freqs[1];
    gain.gain.value = 0.16;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const seconds = DTMF_MS / 1000;
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + seconds);
    osc2.stop(now + seconds);

    window.setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      gain.disconnect();
      this.dtmfPlaying = false;
    }, DTMF_MS + 40);
  }

  private speakDemo(text: string, lang: "hi" | "en", generation: number): void {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this.speaking = false;
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => {
      if (this.generation === generation) this.speaking = false;
    };
    utterance.onerror = () => {
      if (this.generation === generation) this.speaking = false;
    };
    window.speechSynthesis.speak(utterance);
  }

  private async playMpegBlob(
    body: ReadableStream<Uint8Array>,
    generation: number,
    signal: AbortSignal
  ): Promise<void> {
    const parts: Uint8Array[] = [];
    const reader = body.getReader();
    try {
      while (true) {
        if (signal.aborted || this.generation !== generation) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (value) parts.push(value);
      }
    } finally {
      void reader.cancel().catch(() => undefined);
    }

    if (signal.aborted || this.generation !== generation) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const copy = parts.map((part) => {
      const bytes = new Uint8Array(part.byteLength);
      bytes.set(part);
      return bytes;
    });
    const blob = new Blob(copy, { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.audio = audio;
    this.objectUrl = url;
    audio.onended = () => {
      if (this.generation === generation) this.speaking = false;
    };
    await audio.play();
  }

  private stopPlayback(): void {
    this.speaking = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this.audio) {
      this.audio.onended = null;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private updateSilence(pcm: Int16Array): void {
    let sum = 0;
    for (let i = 0; i < pcm.length; i += 1) {
      const sample = pcm[i];
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / Math.max(pcm.length, 1));
    const now = Date.now();
    if (rms < SILENCE_RMS) {
      if (this.silentSince === null) this.silentSince = now;
      if (now - this.silentSince >= SILENCE_MS) {
        this.setLineState("silent");
      }
      return;
    }
    this.silentSince = null;
    this.setLineState("active");
  }

  private setLineState(state: LineState): void {
    if (this.lineState === state) return;
    this.lineState = state;
    this.listeners.forEach((cb) => cb(state));
  }
}

function micConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  };
}

function downsampleToPcm16(
  input: Float32Array,
  inputRate: number,
  outputRate: number
): Int16Array {
  if (inputRate === outputRate) {
    return floatToPcm16(input);
  }

  const ratio = inputRate / outputRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = idx - i0;
    const sample = input[i0] * (1 - frac) + input[i1] * frac;
    out[i] = floatSampleToInt16(sample);
  }
  return out;
}

function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    out[i] = floatSampleToInt16(input[i]);
  }
  return out;
}

function floatSampleToInt16(sample: number): number {
  const clipped = Math.max(-1, Math.min(1, sample));
  return clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;
}
