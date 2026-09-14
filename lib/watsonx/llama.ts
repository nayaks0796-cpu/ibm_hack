// Llama 3.3 70B Instruct — default: Groq; optional: IBM watsonx.ai
// Temperature ~0.2, JSON output only. Three exported functions:
//   suggest()      → reply suggestions for the live call screen
//   extractFacts() → pull reference numbers / facts from captions
//   gloss()        → ISL gloss array for the avatar
// bob: watsonx client + suggestion prompt

import { containsSensitiveCode } from "../guard/otp";
import { missingFactSentence } from "../format";
import { alignGlossToCatalog, captionToGloss, getPreferredGlossWords } from "../isl/mapGloss";
import { keepCaptionRelevant } from "../suggestions/skeleton";
import type { TranscriptEntry } from "../types";

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

function resolveProvider(): LlmProvider {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "groq" || forced === "watsonx") return forced;
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID) {
    return "watsonx";
  }
  throw new Error("No LLM configured: set GROQ_API_KEY (preferred) or watsonx keys");
}

function knownDigitChunks(
  facts: Record<string, string>,
  history: TranscriptEntry[]
): Set<string> {
  const known = new Set<string>();
  const add = (text: string) => {
    for (const match of text.match(/\d{3,}/g) ?? []) known.add(match);
  };
  for (const value of Object.values(facts)) add(value);
  for (const entry of history) add(entry.text);
  return known;
}

export function sanitizeSuggestions(
  raw: Suggestion[],
  facts: Record<string, string>,
  history: TranscriptEntry[]
): Suggestion[] {
  const known = knownDigitChunks(facts, history);
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

export function parseSuggestionJson(raw: string): Suggestion[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Suggestion[];
    return Array.isArray(parsed) ? parsed : [];
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
  const apiKey = process.env.GROQ_API_KEY;
  const model =
    process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You output JSON only. No markdown fences. No prose before or after the JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
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

export async function suggest(
  caption: string,
  history: TranscriptEntry[],
  facts: Record<string, string>,
  goal: string,
  callLanguage: "hi" | "en",
  uiLanguage = "en"
): Promise<Suggestion[]> {
  const factsStr =
    Object.entries(facts)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ") || "none";

  const callLang = callLanguage === "hi" ? "Hindi" : "English";
  const uiLang = UI_LANG_NAME[uiLanguage] ?? "English";
  const missing = missingFactSentence(callLanguage);

  const prompt = `You help a deaf or non-verbal person on one official phone call in India.
The app never speaks unless the user taps a reply suggestion and then taps Send.

Goal: ${goal}
Known facts (these are the ONLY true facts; empty means unknown): ${factsStr}
Conversation so far:
${formatHistory(history)}
Latest clerk line: "${caption}"

Write 3 to 5 reply suggestions for whatever the clerk just said — any topic, any tone.
Rules:
- Answer that specific line first. Do not reuse a fixed menu of consumer number, area, or complaint-number requests.
- If the clerk asked for a known fact, offer that fact. Never invent a number, name, date, address, or account.
- If a needed fact is missing, sentence must be: ${missing}
- If the clerk went off the call goal (chit-chat, "what are you doing", unrelated questions), include ONE suggestion that politely asks them to return to this goal and resolve it: ${goal}
- If they are confused about a robot, recording, or relay, also explain the assistive relay — even if a disclosure was already spoken.
- Do not repeat a sentence that is marked "already said", unless the clerk is asking you to explain it again.
- Do not suggest Wait, Please repeat, I did not understand, or Please give the complaint number.
- Do not include OTP, PIN, CVV, or password.
- label = short button text (max 6 words) in ${uiLang}.
- sentence = exact words to speak, in ${callLang}.
- Output ONLY a JSON array. No markdown. No extra text.

[{"id":"s1","label":"...","sentence":"..."}]`;

  try {
    const raw = await callLlm(prompt);
    return keepCaptionRelevant(
      caption,
      sanitizeSuggestions(parseSuggestionJson(raw), facts, history)
    );
  } catch {
    return [];
  }
}

export async function extractFacts(
  text: string
): Promise<Record<string, string>> {
  const prompt = `Extract structured facts from the following phone call caption text.
Return ONLY a JSON object with key-value string pairs (e.g. reference numbers, names, dates).
If no structured facts are found, return {}.
Text: "${text}"`;

  try {
    const raw = await callLlm(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function gloss(text: string): Promise<string[]> {
  const catalogWords = getPreferredGlossWords().join(" ");
  const prompt = `Convert the following text into an ISL (Indian Sign Language) gloss sequence.
Rules:
- Output ONLY a JSON array of uppercase English words.
- Use core content words only (omit filler words like "a", "the", "is").
- Prefer words from this existing sign catalog. Do not invent a word that is not in the list:
${catalogWords}
- If the meaning is not in the list, pick the closest catalog word.
- For names only, fingerspell each character as a separate item.
- Skip OTP, PIN, CVV, passwords, and long reference numbers.
- No prose, no markdown.

Text: "${text}"
Output:`;

  try {
    const raw = await callLlm(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in gloss response");
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Gloss JSON was not an array");
    const aligned = alignGlossToCatalog(parsed.map((item) => String(item)));
    return aligned.length > 0 ? aligned : captionToGloss(text);
  } catch {
    return captionToGloss(text);
  }
}
