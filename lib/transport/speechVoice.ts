// Pick one browser speechSynthesis voice so mixed Hindi/English text
// does not flip between an English voice and a Hindi voice mid-sentence.

export function pickUtteranceVoice(
  lang: "hi" | "en"
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const wanted = lang === "hi" ? "hi" : "en";
  const byTag = voices.find((voice) =>
    voice.lang.toLowerCase().replace("_", "-").startsWith(wanted)
  );
  if (byTag) return byTag;
  if (lang === "hi") {
    return (
      voices.find((voice) => /hindi|हिन्दी|हिंदी/i.test(voice.name)) ?? null
    );
  }
  return (
    voices.find((voice) => /english|india/i.test(`${voice.name} ${voice.lang}`)) ??
    null
  );
}

export function applyUtteranceVoice(
  utterance: SpeechSynthesisUtterance,
  lang: "hi" | "en"
): void {
  utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
  if (typeof window !== "undefined" && window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.getVoices();
  }
  const voice = pickUtteranceVoice(lang);
  if (voice) utterance.voice = voice;
}
