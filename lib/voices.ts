// TTS voice catalog — premade ElevenLabs voices this API key can actually use.
// Library voices (Viraj, Monika, …) are omitted: free keys get paid_plan_required.
// Profile stores `id`. /api/tts resolves to the ElevenLabs UUID via envVar (if set) else elevenLabsId.

import type { CallLanguage } from "./types";

export interface VoiceOption {
  /** Stable id stored in UserProfile.voice */
  id: string;
  /** Button label (proper names stay as-is across UI languages). */
  name: string;
  /** Call language this voice is offered for. */
  lang: CallLanguage;
  /**
   * ElevenLabs voice UUID used when the env override is unset.
   * Put the real ID here when you add a voice; optionally also add envVar.
   */
  elevenLabsId: string;
  /**
   * Public ElevenLabs sample MP3 for setup Play (no TTS credits).
   * English-only samples — omit on Hindi entries so Play uses live Hindi TTS.
   */
  previewUrl?: string;
  /** Optional process.env key that overrides elevenLabsId on the server. */
  envVar?: string;
}

/** Shared fallback when a catalog entry has no usable ID. */
export const FALLBACK_ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

type PremadeVoice = {
  slug: string;
  name: string;
  elevenLabsId: string;
  previewUrl?: string;
};

/** Premade voices confirmed usable on the current free ElevenLabs key. */
const PREMADE_VOICES: PremadeVoice[] = [
  {
    slug: "george",
    name: "George",
    elevenLabsId: FALLBACK_ELEVENLABS_VOICE_ID,
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3",
  },
  { slug: "sarah", name: "Sarah", elevenLabsId: "EXAVITQu4vr4xnSDxMaL" },
  { slug: "daniel", name: "Daniel", elevenLabsId: "onwK4e9ZLuTAKqWW03F9" },
  { slug: "alice", name: "Alice", elevenLabsId: "Xb7hH8MSUJpSbSDYk0k2" },
  { slug: "roger", name: "Roger", elevenLabsId: "CwhRBWXzGAHq8TQ4Fs17" },
  { slug: "eric", name: "Eric", elevenLabsId: "cjVigY5qzO86Huf0OWal" },
  { slug: "jessica", name: "Jessica", elevenLabsId: "cgSgspJ2msm6clMCkdW9" },
  { slug: "lily", name: "Lily", elevenLabsId: "pFZP5JQG7iQjIQuC4Bku" },
  { slug: "matilda", name: "Matilda", elevenLabsId: "XrExE9yKIg1WjnnlVkGX" },
  { slug: "bella", name: "Bella", elevenLabsId: "hpp4J3VqNfWAUOO0d1Us" },
  { slug: "chris", name: "Chris", elevenLabsId: "iP95p4xoKVk53GoZ742B" },
  { slug: "brian", name: "Brian", elevenLabsId: "nPczCjzI2devNBz1zQrb" },
  { slug: "will", name: "Will", elevenLabsId: "bIHbv24MWmeRgasZH58o" },
  { slug: "river", name: "River", elevenLabsId: "SAz9YHcvj6GT2YYXdXww" },
  { slug: "liam", name: "Liam", elevenLabsId: "TX3LPaxmHKxFdv7VOQHJ" },
  { slug: "charlie", name: "Charlie", elevenLabsId: "IKne3meq5aSn9XLyUdCD" },
  { slug: "bill", name: "Bill", elevenLabsId: "pqHfZKP75CvOlQylNhV4" },
  { slug: "adam", name: "Adam", elevenLabsId: "pNInz6obpgDQGcFmaJgB" },
  { slug: "laura", name: "Laura", elevenLabsId: "FGY2WhTYpPnrIDTdsKH5" },
  { slug: "callum", name: "Callum", elevenLabsId: "N2lVS1w4EtoT3dr4eOWO" },
  { slug: "harry", name: "Harry", elevenLabsId: "SOYHLrjzK2X1ezoPC6cr" },
];

function catalogId(lang: CallLanguage, slug: string, index: number): string {
  if (lang === "hi") {
    if (index === 0) return "hi-1";
    if (index === 1) return "hi-2";
    if (index === 2) return "hi-3";
    return `hi-${slug}`;
  }
  if (slug === "george") return "en";
  if (index === 1) return "en-1";
  if (index === 2) return "en-2";
  if (index === 3) return "en-3";
  return `en-${slug}`;
}

/**
 * Available voices. To add another:
 * 1. Append an entry with a unique `id`, `lang`, and ElevenLabs `elevenLabsId`
 * 2. Optionally set `previewUrl` (public sample) and `envVar` in .env.local
 */
export const VOICES: VoiceOption[] = [
  ...PREMADE_VOICES.map((voice, index) => ({
    id: catalogId("hi", voice.slug, index),
    name: voice.name,
    lang: "hi" as const,
    elevenLabsId: voice.elevenLabsId,
  })),
  ...PREMADE_VOICES.map((voice, index) => ({
    id: catalogId("en", voice.slug, index),
    name: voice.name,
    lang: "en" as const,
    elevenLabsId: voice.elevenLabsId,
    previewUrl: voice.previewUrl,
  })),
];

export function voicesFor(callLanguage: CallLanguage): VoiceOption[] {
  return VOICES.filter((voice) => voice.lang === callLanguage);
}

export function isVoiceId(value: string): boolean {
  return VOICES.some((voice) => voice.id === value);
}

export function defaultVoiceId(callLanguage: CallLanguage): string {
  return voicesFor(callLanguage)[0]?.id ?? VOICES[0]?.id ?? "hi-1";
}

/** Map stored / legacy values ("hi", "en", "demo") to a valid catalog id for this call language. */
export function resolveVoiceId(
  stored: string | undefined,
  callLanguage: CallLanguage
): string {
  if (stored) {
    // Old Hindi default was George under id "hi" (English sample) — treat as unset.
    if (stored === "hi" && callLanguage === "hi") {
      return defaultVoiceId("hi");
    }
    const voice = getVoice(stored);
    if (voice && voice.lang === callLanguage) return voice.id;
  }
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
