import { detectReferenceNumbers } from "../guard/refnum";
import { catalogLemma, hasSign } from "./catalog";
import { DROP_WORDS, PHRASES, WORD_SYNONYMS } from "./synonyms";

const PHRASES_LONGEST_FIRST = [...PHRASES].sort((a, b) => {
  const words = b[0].split(/\s+/).length - a[0].split(/\s+/).length;
  if (words !== 0) return words;
  return b[0].length - a[0].length;
});

export function normalizeToken(raw: string): string {
  return raw
    .normalize("NFC")
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-zA-Z0-9\u0900-\u097F'-]+/g, "")
    .toLowerCase();
}

function looksLikeCode(token: string): boolean {
  if (/\d{3,}/.test(token)) return true;
  if (/^[a-z]{2,6}-?\d{3,}$/i.test(token)) return true;
  return false;
}

function toGlossToken(lemma: string): string {
  return lemma.trim().toLowerCase().toUpperCase();
}

function fingerspell(word: string): string[] {
  const letters: string[] = [];
  for (const ch of word.toUpperCase()) {
    if (!/[A-Z0-9]/.test(ch)) continue;
    if (hasSign(ch)) letters.push(ch);
  }
  return letters;
}

function resolveLemma(word: string): string[] | "drop" | "spell" | null {
  const mapped = WORD_SYNONYMS[word];
  if (mapped) {
    const lemmas = mapped.filter((item) => hasSign(item));
    return lemmas.length > 0 ? lemmas : "drop";
  }
  if (DROP_WORDS.has(word)) return "drop";
  if (hasSign(word)) {
    const lemma = catalogLemma(word);
    return lemma ? [lemma] : "drop";
  }
  return null;
}

function stemCandidates(word: string): string[] {
  const out: string[] = [];
  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    out.push(base, `${base}e`);
    if (/(.)\1$/.test(base)) out.push(base.slice(0, -1));
  }
  if (word.endsWith("ed") && word.length > 4) {
    const base = word.slice(0, -2);
    out.push(base, `${base}e`, word.slice(0, -1));
    if (/(.)\1$/.test(base)) out.push(base.slice(0, -1));
  }
  if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss")) {
    out.push(word.slice(0, -1));
  }
  return out;
}

function lemmasForWord(word: string): string[] | "drop" | "spell" {
  if (!word) return "drop";
  if (looksLikeCode(word)) return "drop";

  const direct = resolveLemma(word);
  if (direct) return direct;

  for (const stem of stemCandidates(word)) {
    const stemmed = resolveLemma(stem);
    if (stemmed && stemmed !== "spell") return stemmed;
  }

  if (/^[\u0900-\u097F]+$/.test(word)) return "drop";
  return "spell";
}

function applyPhrasesToTokens(tokens: string[]): string[] {
  const lower = tokens.map((token) => token.toLowerCase());
  const out: string[] = [];
  let i = 0;
  while (i < lower.length) {
    let matched = false;
    for (const [phrase, lemmas] of PHRASES_LONGEST_FIRST) {
      const parts = phrase.split(/\s+/);
      if (parts.every((part, offset) => lower[i + offset] === part)) {
        out.push(...lemmas);
        i += parts.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out;
}

function applyPhrasesToText(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0900-\u097F'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let next = ` ${cleaned} `;
  for (const [phrase, lemmas] of PHRASES_LONGEST_FIRST) {
    const needle = ` ${phrase} `;
    const replacement = ` ${lemmas.join(" ")} `;
    next = next.split(needle).join(replacement);
  }
  return next.trim();
}

function stripCodes(text: string): string {
  let next = text;
  for (const ref of detectReferenceNumbers(text)) {
    const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(escaped, "ig"), " ");
  }
  return next.replace(/\b\d{3,}\b/g, " ");
}

function emit(word: string, out: string[], allowSpell = true): void {
  const result = lemmasForWord(normalizeToken(word));
  if (result === "drop") return;
  if (result === "spell") {
    if (allowSpell) {
      out.push(...fingerspell(word));
    }
    return;
  }
  for (const lemma of result) out.push(toGlossToken(lemma));
}

function uniqueAdjacent(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (out[out.length - 1] === token) continue;
    out.push(token);
  }
  return out;
}

function keepForSecondPass(token: string): boolean {
  const word = normalizeToken(token);
  if (!word) return false;
  if (WORD_SYNONYMS[word]) return true;
  if (looksLikeCode(word) || DROP_WORDS.has(word)) return false;
  return true;
}

/** Map Llama (or any) gloss tokens onto signs that exist. Last resort: fingerspell (if allowed). */
export function alignGlossToCatalog(tokens: string[], allowSpell = true): string[] {
  const cleaned = tokens.map(normalizeToken).filter(Boolean);
  const pass1 = applyPhrasesToTokens(cleaned);
  const pass2 = applyPhrasesToTokens(pass1.filter(keepForSecondPass));
  const out: string[] = [];
  for (const token of pass2) emit(token, out, allowSpell);
  return uniqueAdjacent(out);
}

/** Deterministic caption → gloss. Prefer real signs; fingerspell when nothing matches. */
export function captionToGloss(text: string): string[] {
  const stripped = stripCodes(text);
  const rewritten = applyPhrasesToText(stripped);
  const tokens = rewritten.split(/[\s,./:;!?|]+/).filter(Boolean);
  const result = alignGlossToCatalog(tokens, false);
  if (result.length === 0 && tokens.length > 0) {
    return alignGlossToCatalog(tokens, true);
  }
  return result;
}

export function scoreGloss(tokens: string[]): {
  signed: number;
  spelled: number;
  rate: number;
} {
  let signed = 0;
  let spelled = 0;
  for (const token of tokens) {
    if (token.length === 1) spelled += 1;
    else signed += 1;
  }
  const total = signed + spelled;
  return { signed, spelled, rate: total === 0 ? 0 : signed / total };
}

export function getPreferredGlossWords(): string[] {
  const lemmas = new Set<string>();
  for (const targets of Object.values(WORD_SYNONYMS)) {
    for (const lemma of targets) {
      if (hasSign(lemma)) lemmas.add(lemma.toUpperCase());
    }
  }
  for (const [, targets] of PHRASES) {
    for (const lemma of targets) {
      if (hasSign(lemma)) lemmas.add(lemma.toUpperCase());
    }
  }
  return [...lemmas].sort();
}
