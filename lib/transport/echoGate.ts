/** How long the clerk mic should ignore audio after caller TTS starts. */
export function ttsHoldMs(text: string): number {
  const chars = text.trim().length;
  return Math.min(12_000, Math.max(900, Math.ceil(chars * 75) + 450));
}

export function normalizeHeard(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when clerk STT is almost certainly hearing our own TTS. */
export function isEchoOfRecentTts(heard: string, spoken: string): boolean {
  const a = normalizeHeard(heard);
  const b = normalizeHeard(spoken);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && (b.includes(a) || a.includes(b))) return true;

  const aTokens = new Set(a.split(" ").filter((token) => token.length > 1));
  const bTokens = new Set(b.split(" ").filter((token) => token.length > 1));
  if (aTokens.size === 0 || bTokens.size === 0) return false;

  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  const ratio = overlap / Math.min(aTokens.size, bTokens.size);
  return overlap >= 3 && ratio >= 0.7;
}
