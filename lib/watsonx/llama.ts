// Reply LLM — default: Groq openai/gpt-oss-120b (Llama 3.3 70B on Groq
// is enterprise-only since 2026-08-16); optional: IBM watsonx.ai
// Temperature ~0.2, JSON output only. Three exported functions:
//   suggest()      → reply suggestions for the live call screen
//   extractFacts() → pull reference numbers / facts from captions
//   gloss()        → ISL gloss array for the avatar
// bob: watsonx client + suggestion prompt

import { containsSensitiveCode } from "../guard/otp";
import {
  clerkSpokenReferenceNumbers,
  detectReferenceNumbers,
} from "../guard/refnum";
import { missingFactSentence } from "../format";
import {
  alignGlossToCatalog,
  captionToGloss,
  getPreferredGlossWords,
  scoreGloss,
} from "../isl/mapGloss";
import { formatPlaybookStages, getPlaybook } from "../playbooks";
import { keepCaptionRelevant } from "../suggestions/skeleton";
import type { CallLanguage, TranscriptEntry } from "../types";

export interface Suggestion {
  id: string;
  /** Short button label in UI language. */
  label: string;
  /** Exact sentence TTS will speak, in call language. */
  sentence: string;
}

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

const UI_LANG_NAME: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
};

type LlmProvider = "groq" | "watsonx";

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
/** Groq retired these for free/developer keys on 2026-08-16. */
const RETIRED_GROQ_MODELS: Record<string, string> = {
  "llama-3.3-70b-versatile": DEFAULT_GROQ_MODEL,
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
};

function resolveProvider(): LlmProvider {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "groq" || forced === "watsonx") return forced;
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  if (process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID) {
    return "watsonx";
  }
  throw new Error("No LLM configured: set GROQ_API_KEY (preferred) or watsonx keys");
}

function resolveGroqModel(): string {
  const requested = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  const mapped = RETIRED_GROQ_MODELS[requested];
  if (mapped && mapped !== requested) {
    console.warn(
      `[llm] Groq model "${requested}" is retired for this plan; using ${mapped}`
    );
    return mapped;
  }
  return requested;
}

function knownDigitChunks(
  facts: Record<string, string>,
  history: TranscriptEntry[],
  caption = ""
): Set<string> {
  const known = new Set<string>();
  const add = (text: string) => {
    for (const match of text.match(/\d{3,}/g) ?? []) known.add(match);
  };
  for (const value of Object.values(facts)) add(value);
  for (const entry of history) add(entry.text);
  add(caption);
  return known;
}

function clerkSpokenRefs(
  history: TranscriptEntry[],
  caption = ""
): Set<string> {
  const known = new Set(clerkSpokenReferenceNumbers(history));
  for (const ref of detectReferenceNumbers(caption)) known.add(ref);
  return known;
}

/** Prompt line: clerk-spoken complaint numbers only — never user facts. */
export function formatClerkComplaintNumbers(
  history: TranscriptEntry[],
  caption = ""
): string {
  const refs = [...clerkSpokenRefs(history, caption)];
  if (refs.length === 0) {
    return "Clerk-given complaint/reference numbers: none yet. Do not invent one.";
  }
  return `Clerk-given complaint/reference numbers (from clerk speech only — treat these as the official complaint numbers; you may confirm or read them back; never invent a different one): ${refs.join(", ")}`;
}

export function sanitizeSuggestions(
  raw: Suggestion[],
  facts: Record<string, string>,
  history: TranscriptEntry[],
  caption = ""
): Suggestion[] {
  const known = knownDigitChunks(facts, history, caption);
  const clerkRefs = clerkSpokenRefs(history, caption);
  const seen = new Set<string>();
  const clean: Suggestion[] = [];

  for (const item of raw) {
    const label = String(item.label ?? "").trim();
    const sentence = String(item.sentence ?? "").trim();
    if (!label || !sentence) continue;
    if (containsSensitiveCode(sentence)) continue;
    const invented = (sentence.match(/\d{3,}/g) ?? []).some(
      (digits) => !known.has(digits)
    );
    if (invented) continue;
    // Never speak a complaint/reference number the clerk did not say.
    const inventedRef = detectReferenceNumbers(sentence).some(
      (ref) => !clerkRefs.has(ref)
    );
    if (inventedRef) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({
      id: String(item.id || `s${clean.length + 1}`),
      label: label.slice(0, 48),
      sentence,
    });
    if (clean.length >= 5) break;
  }

  return clean;
}

function asSuggestionList(value: unknown): Suggestion[] {
  if (Array.isArray(value)) return value as Suggestion[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { suggestions?: unknown }).suggestions)
  ) {
    return (value as { suggestions: Suggestion[] }).suggestions;
  }
  return [];
}

export function parseSuggestionJson(raw: string): Suggestion[] {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const list = asSuggestionList(parsed);
    if (list.length) return list;
  } catch {
    // Model may wrap JSON in prose or fences — try a substring next.
  }
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const list = asSuggestionList(JSON.parse(objectMatch[0]) as unknown);
      if (list.length) return list;
    } catch {
      // Fall through to array match.
    }
  }
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return asSuggestionList(JSON.parse(match[0]) as unknown);
  } catch {
    return [];
  }
}

async function getIamToken(apiKey: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const iamRes = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  });
  if (!iamRes.ok) {
    throw new Error(`IAM token error: ${await iamRes.text()}`);
  }
  const data = (await iamRes.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const lifeMs = Math.max(60, (data.expires_in ?? 3600) - 60) * 1000;
  tokenCache = { token: data.access_token, expiresAt: Date.now() + lifeMs };
  return data.access_token;
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = resolveGroqModel();

  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You output a JSON object only. No markdown fences. No prose before or after the JSON.",
      },
      { role: "user", content: prompt },
    ],
  };
  if (model.includes("gpt-oss")) {
    body.reasoning_effort = "low";
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null; reasoning?: string | null };
    }>;
  };
  const text = groqMessageText(data);
  if (!text) {
    throw new Error("Groq returned an empty message");
  }
  return text;
}

function groqMessageText(data: {
  choices?: Array<{
    message?: { content?: string | null; reasoning?: string | null };
  }>;
}): string {
  const msg = data.choices?.[0]?.message;
  const content = msg?.content?.trim() ?? "";
  if (content) return content;
  return msg?.reasoning?.trim() ?? "";
}

async function callWatsonx(prompt: string): Promise<string> {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const baseUrl = process.env.WATSONX_URL ?? "https://us-south.ml.cloud.ibm.com";
  const model = process.env.WATSONX_MODEL ?? "meta-llama/llama-3-3-70b-instruct";

  if (!apiKey || !projectId) {
    throw new Error("WATSONX_API_KEY or WATSONX_PROJECT_ID not configured");
  }

  const accessToken = await getIamToken(apiKey);
  const res = await fetch(`${baseUrl}/ml/v1/text/generation?version=2023-05-29`, {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: model,
      input: prompt,
      parameters: {
        decoding_method: "greedy",
        temperature: 0.2,
        max_new_tokens: 400,
        stop_sequences: ["```"],
      },
      project_id: projectId,
    }),
  });

  if (!res.ok) {
    throw new Error(`watsonx error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    results: Array<{ generated_text: string }>;
  };
  return data.results?.[0]?.generated_text ?? "";
}

async function callLlm(prompt: string): Promise<string> {
  const provider = resolveProvider();
  return provider === "groq" ? callGroq(prompt) : callWatsonx(prompt);
}

function formatHistory(history: TranscriptEntry[]): string {
  if (history.length === 0) return "(none yet)";
  return history
    .slice(-6)
    .map((entry) => {
      if (entry.side === "clerk") return `Clerk (just heard): ${entry.text}`;
      if (entry.source === "user-voice") {
        return `You (already said, user spoke this — do not repeat): ${entry.text}`;
      }
      return `You (already said — do not repeat): ${entry.text}`;
    })
    .join("\n");
}

export function formatTypicalFlow(
  playbookId: string,
  callLanguage: CallLanguage
): string {
  const playbook = getPlaybook(playbookId);
  const stages = formatPlaybookStages(playbook?.stages, callLanguage);
  if (!stages) return "";
  return `Typical call flow (a map of usual next steps — NOT facts, NOT a transcript, NOT text to copy):
${stages}`;
}

export async function suggest(
  caption: string,
  history: TranscriptEntry[],
  facts: Record<string, string>,
  goal: string,
  callLanguage: "hi" | "en",
  uiLanguage = "en",
  playbookId = ""
): Promise<Suggestion[]> {
  const factsStr =
    Object.entries(facts)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ") || "none";

  const callLang = callLanguage === "hi" ? "Hindi" : "English";
  const uiLang = UI_LANG_NAME[uiLanguage] ?? "English";
  const missing = missingFactSentence(callLanguage);
  const typical = formatTypicalFlow(playbookId, callLanguage);
  const clerkNumbers = formatClerkComplaintNumbers(history, caption);
  const clerkNumberRule = clerkNumbers.includes("none yet")
    ? "No clerk-given complaint number exists yet. If the goal still needs one, ask the clerk to provide it — do not invent one."
    : "A clerk-given complaint/reference number exists. Treat it as the official complaint number. Thank them or read that exact number back. Do not ask for a complaint number again unless they asked you to confirm it. Never invent a different one.";

  const prompt = `You help a deaf or non-verbal person on one official phone call in India.
The app never speaks unless the user taps a reply suggestion and then taps Send.

Goal: ${goal}
Known facts (user-typed only; empty means unknown; these are NOT complaint numbers): ${factsStr}
${clerkNumbers}
${typical ? `${typical}\n` : ""}Conversation so far:
${formatHistory(history)}
Latest clerk line: "${caption}"

Write 3 to 5 reply suggestions for whatever the clerk just said — any topic, any tone.
Rules:
- Answer that specific line first. Do not reuse a fixed menu of consumer number, area, or complaint-number requests.
- If the clerk asked for a known fact, offer that fact. Never invent a number, name, date, address, or account.
- Never invent, guess, or speak a complaint number, reference number, or ticket number. Those come only from the clerk.
- Known facts (consumer number, area, etc.) are never a complaint number. Do not present them as one.
- ${clerkNumberRule}
- If a needed fact is missing, sentence must be: ${missing}
- Use the typical call flow only to guess the next move. Never copy those lines. Never treat them as already said. Never take numbers or names from them.
- Never use any past call, other user's conversation, or saved transcript.
- If the clerk went off the call goal (chit-chat, "what are you doing", unrelated questions), include ONE suggestion that politely asks them to return to this goal and resolve it: ${goal}
- If they are confused about a robot, recording, or relay, also explain the assistive relay — even if a disclosure was already spoken.
- Do not repeat a sentence that is marked "already said", unless the clerk is asking you to explain it again.
- Do not suggest Wait, Please repeat, I did not understand, or Please give the complaint number.
- Do not include OTP, PIN, CVV, password, or Aadhaar number.
- label = short button text (max 6 words) in ${uiLang}.
- sentence = exact words to speak, in ${callLang}.
- Output ONLY a JSON object. No markdown. No extra text.

{"suggestions":[{"id":"s1","label":"...","sentence":"..."}]}`;

  try {
    const raw = await callLlm(prompt);
    return keepCaptionRelevant(
      caption,
      sanitizeSuggestions(parseSuggestionJson(raw), facts, history, caption),
      history
    );
  } catch (err) {
    console.error("[llm] suggest failed:", err);
    return [];
  }
}

/** Detector-only complaint numbers from clerk text. Never from the LLM or our side. */
export function attachClerkReferenceFacts(
  parsed: Record<string, string>,
  clerkText: string,
  fromClerk = true
): Record<string, string> {
  const clerkRefs = fromClerk ? detectReferenceNumbers(clerkText) : [];
  const clean: Record<string, string> = {};
  if (clerkRefs[0]) clean.reference_number = clerkRefs[0];
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const lower = key.toLowerCase();
    if (
      lower.includes("reference") ||
      lower.includes("complaint") ||
      lower.includes("ticket") ||
      lower.includes("shikayat")
    ) {
      continue;
    }
    const refsInValue = detectReferenceNumbers(value);
    if (refsInValue.some((ref) => !clerkRefs.includes(ref))) continue;
    clean[key] = value.trim();
  }
  return clean;
}

export async function extractFacts(
  text: string,
  fromClerk = true
): Promise<Record<string, string>> {
  // Complaint/reference numbers: detector on clerk text only — never trust the LLM.
  const fromDetector = attachClerkReferenceFacts({}, text, fromClerk);

  const prompt = `Extract structured facts from the following phone call caption text.
Return ONLY a JSON object with key-value string pairs (e.g. names, dates, places).
Do NOT invent or guess a complaint number, reference number, or ticket number.
If a complaint/reference number appears in the text, omit it from your JSON — it is handled separately.
If no structured facts are found, return {}.
Text: "${text}"`;

  try {
    const raw = await callLlm(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fromDetector;
    const parsed = JSON.parse(match[0]) as Record<string, string>;
    return attachClerkReferenceFacts(parsed, text, fromClerk);
  } catch (err) {
    console.error("[llm] extractFacts failed:", err);
    return fromDetector;
  }
}

export async function gloss(text: string): Promise<string[]> {
  const catalogWords = getPreferredGlossWords().join(" ");
  const prompt = `Convert the following text into an ISL (Indian Sign Language) gloss sequence.
Rules:
- Output ONLY a JSON object: {"gloss":["WORD","WORD"]}
- gloss values are uppercase English words.
- Use core content words only (omit filler words like "a", "the", "is").
- Prefer words from this existing sign catalog. Do not invent a word that is not in the list:
${catalogWords}
- If the meaning is not in the list, pick the closest catalog word.
- For names only, fingerspell each character as a separate item.
- Skip OTP, PIN, CVV, passwords, and long reference numbers.
- No prose, no markdown.

Text: "${text}"
Output:`;

  const local = captionToGloss(text);
  try {
    const raw = await callLlm(prompt);
    const words = parseGlossJson(raw);
    if (words.length === 0) throw new Error("No gloss array in response");
    const aligned = alignGlossToCatalog(words);
    return pickBetterGloss(aligned, local);
  } catch (err) {
    console.error("[llm] gloss failed:", err);
    return local;
  }
}

export function pickBetterGloss(llm: string[], local: string[]): string[] {
  if (llm.length === 0) return local;
  if (local.length === 0) return llm;
  const remote = scoreGloss(llm);
  const fallback = scoreGloss(local);
  if (remote.signed !== fallback.signed) {
    return remote.signed > fallback.signed ? llm : local;
  }
  if (remote.rate !== fallback.rate) {
    return remote.rate > fallback.rate ? llm : local;
  }
  return local;
}

function parseGlossJson(raw: string): string[] {
  const take = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === "string") {
      return value.split(/[\s,]+/).filter(Boolean);
    }
    if (value && typeof value === "object") {
      const gloss = (value as { gloss?: unknown }).gloss;
      if (Array.isArray(gloss)) return gloss.map((item) => String(item));
      if (typeof gloss === "string") {
        return gloss.split(/[\s,]+/).filter(Boolean);
      }
    }
    return [];
  };
  try {
    const parsed = JSON.parse(raw.trim()) as unknown;
    const words = take(parsed);
    if (words.length) return words;
  } catch {
    // Try a substring.
  }
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const words = take(JSON.parse(objectMatch[0]) as unknown);
      if (words.length) return words;
    } catch {
      // Fall through.
    }
  }
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return take(JSON.parse(match[0]) as unknown);
  } catch {
    return [];
  }
}
