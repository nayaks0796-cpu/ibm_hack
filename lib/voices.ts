// TTS voice catalog — append entries here when adding ElevenLabs voices.
// Profile stores `id`. /api/tts resolves to the ElevenLabs UUID via envVar (if set) else elevenLabsId.

import type { CallLanguage } from "./types";

export interface VoiceOption {
  /** Stable id stored in UserProfile.voice */
  id: string;
  /** Button label (proper names stay as-is across UI languages). */
  name: string;
  /**
   * ElevenLabs voice UUID used when the env override is unset.
   * Put the real ID here when you add a voice; optionally also add envVar.
   */
  elevenLabsId: string;
  /** Optional process.env key that overrides elevenLabsId on the server. */
  envVar?: string;
}

/** Shared fallback when a catalog entry has no usable ID. */
export const FALLBACK_ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

/**
 * Available voices. To add another:
 * 1. Append an entry with a unique `id` and ElevenLabs `elevenLabsId`
 * 2. Optionally set `envVar` (e.g. ELEVENLABS_VOICE_ID_RAVI) in .env.local
 */
export const VOICES: VoiceOption[] = [
  {
    id: "hi",
    name: "Hindi",
    elevenLabsId: FALLBACK_ELEVENLABS_VOICE_ID,
    envVar: "ELEVENLABS_VOICE_ID_HI",
  },
  {
    id: "en",
    name: "English",
    elevenLabsId: FALLBACK_ELEVENLABS_VOICE_ID,
    envVar: "ELEVENLABS_VOICE_ID_EN",
  },
];

export function isVoiceId(value: string): boolean {
  return VOICES.some((voice) => voice.id === value);
}

export function defaultVoiceId(callLanguage: CallLanguage): string {
  const match = VOICES.find((voice) => voice.id === callLanguage);
  return match?.id ?? VOICES[0]?.id ?? "hi";
}

/** Map stored / legacy values ("demo") to a valid catalog id. */
export function resolveVoiceId(
  stored: string | undefined,
  callLanguage: CallLanguage
): string {
  if (stored && isVoiceId(stored)) return stored;
  return defaultVoiceId(callLanguage);
}

export function getVoice(id: string): VoiceOption | undefined {
  return VOICES.find((voice) => voice.id === id);
}

/**
 * Server-only: catalog id → ElevenLabs UUID.
 * Order: voice envVar → catalog elevenLabsId → ELEVENLABS_VOICE_ID → hardcoded fallback.
 */
export function elevenLabsIdFor(voiceId: string, lang?: string): string {
  const voice = getVoice(voiceId);
  if (voice) {
    const fromEnv = voice.envVar ? process.env[voice.envVar]?.trim() : "";
    if (fromEnv) return fromEnv;
    if (voice.elevenLabsId.trim()) return voice.elevenLabsId.trim();
    const shared = process.env.ELEVENLABS_VOICE_ID?.trim();
    if (shared) return shared;
    return FALLBACK_ELEVENLABS_VOICE_ID;
  }

  // Unknown / missing selection — keep previous lang-based env behaviour.
  if (lang === "hi") {
    return (
      process.env.ELEVENLABS_VOICE_ID_HI?.trim() ||
      process.env.ELEVENLABS_VOICE_ID?.trim() ||
      FALLBACK_ELEVENLABS_VOICE_ID
    );
  }
  if (lang === "en") {
    return (
      process.env.ELEVENLABS_VOICE_ID_EN?.trim() ||
      process.env.ELEVENLABS_VOICE_ID?.trim() ||
      FALLBACK_ELEVENLABS_VOICE_ID
    );
  }

  return (
    process.env.ELEVENLABS_VOICE_ID?.trim() || FALLBACK_ELEVENLABS_VOICE_ID
  );
}
