// Llama 3.3 70B Instruct on IBM watsonx.ai
// Temperature ~0.2, JSON output only. Three exported functions:
//   suggest()      → reply suggestions for the live call screen
//   extractFacts() → pull reference numbers / facts from captions
//   gloss()        → ISL gloss array for the avatar
// bob: watsonx client + suggestion prompt

import type { TranscriptEntry } from "../types";

export interface Suggestion {
  id: string;
  /** Short button label in UI language. */
  label: string;
  /** Exact sentence TTS will speak, in call language. */
  sentence: string;
}

// ── Always-present fallback suggestions (AGENTS.md rule) ──────────────────────
const ALWAYS_PRESENT_EN: Suggestion[] = [
  { id: "ap-wait", label: "Wait", sentence: "Please give me a moment." },
  { id: "ap-repeat", label: "Please repeat", sentence: "Could you please repeat that?" },
  { id: "ap-unclear", label: "I did not understand", sentence: "I did not understand. Could you please clarify?" },
  { id: "ap-refnum", label: "Please give the complaint number", sentence: "Could you please give me the complaint or reference number?" },
];

const ALWAYS_PRESENT_HI: Suggestion[] = [
  { id: "ap-wait", label: "रुकिए", sentence: "एक पल रुकिए।" },
  { id: "ap-repeat", label: "दोबारा बोलिए", sentence: "क्या आप दोबारा बोल सकते हैं?" },
  { id: "ap-unclear", label: "समझ नहीं आया", sentence: "मुझे समझ नहीं आया। क्या आप स्पष्ट कर सकते हैं?" },
  { id: "ap-refnum", label: "शिकायत नंबर दीजिए", sentence: "क्या आप मुझे शिकायत या संदर्भ संख्या दे सकते हैं?" },
];

// ── watsonx REST helper ───────────────────────────────────────────────────────

async function callWatsonx(prompt: string): Promise<string> {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const baseUrl = process.env.WATSONX_URL ?? "https://us-south.ml.cloud.ibm.com";
  const model = process.env.WATSONX_MODEL ?? "meta-llama/llama-3-3-70b-instruct";

  if (!apiKey || !projectId) {
    throw new Error("WATSONX_API_KEY or WATSONX_PROJECT_ID not configured");
  }

  // Get IAM token using the API key.
  const iamRes = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  });
  if (!iamRes.ok) {
    throw new Error(`IAM token error: ${await iamRes.text()}`);
  }
  const { access_token } = await iamRes.json() as { access_token: string };

  const res = await fetch(`${baseUrl}/ml/v1/text/generation?version=2023-05-29`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: model,
      input: prompt,
      parameters: {
        decoding_method: "greedy",
        temperature: 0.2,
        max_new_tokens: 512,
        stop_sequences: ["```"],
      },
      project_id: projectId,
    }),
  });

  if (!res.ok) {
    throw new Error(`watsonx error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json() as { results: Array<{ generated_text: string }> };
  return data.results?.[0]?.generated_text ?? "";
}

// ── suggest() ─────────────────────────────────────────────────────────────────

export async function suggest(
  caption: string,
  history: TranscriptEntry[],
  facts: Record<string, string>,
  goal: string,
  callLanguage: "hi" | "en"
): Promise<Suggestion[]> {
  const alwaysPresent = callLanguage === "hi" ? ALWAYS_PRESENT_HI : ALWAYS_PRESENT_EN;

  const recentHistory = history.slice(-6).map(
    (e) => `${e.side === "clerk" ? "Clerk" : "You"}: ${e.text}`
  ).join("\n");

  const factsStr = Object.entries(facts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const lang = callLanguage === "hi" ? "Hindi" : "English";

  const prompt = `You are an assistive relay agent helping a deaf or non-verbal person on an official phone call.
Goal: ${goal}
Known facts about the caller: ${factsStr || "none"}
Recent conversation:
${recentHistory || "(none yet)"}
Latest thing the clerk just said: "${caption}"

Your task: Generate 3 to 5 reply suggestions that the user can tap to respond.
Rules:
- Only use facts provided above. Never invent numbers, names, or details.
- If a needed fact is missing, suggest "I will check and tell you."
- label = very short (≤6 words) in ${lang} for the button.
- sentence = the exact sentence TTS will speak, in ${lang}.
- Output ONLY valid JSON, no prose, no markdown fences.

Output format (array of objects):
[{"id":"s1","label":"...","sentence":"..."},...]`;

  try {
    const raw = await callWatsonx(prompt);
    // Extract the first JSON array from the response.
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in response");
    const parsed = JSON.parse(match[0]) as Suggestion[];
    // Merge always-present suggestions, deduplicating by id.
    const ids = new Set(parsed.map((s) => s.id));
    const merged = [
      ...parsed,
      ...alwaysPresent.filter((s) => !ids.has(s.id)),
    ];
    return merged;
  } catch {
    // On any failure, return always-present fallback so the UI is never empty.
    return alwaysPresent;
  }
}

// ── extractFacts() ────────────────────────────────────────────────────────────

export async function extractFacts(
  text: string
): Promise<Record<string, string>> {
  const prompt = `Extract structured facts from the following phone call caption text.
Return ONLY a JSON object with key-value string pairs (e.g. reference numbers, names, dates).
If no structured facts are found, return {}.
Text: "${text}"`;

  try {
    const raw = await callWatsonx(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]) as Record<string, string>;
  } catch {
    return {};
  }
}

// ── gloss() ───────────────────────────────────────────────────────────────────

export async function gloss(text: string): Promise<string[]> {
  const prompt = `Convert the following text into an ISL (Indian Sign Language) gloss sequence.
Rules:
- Output ONLY a JSON array of uppercase English words.
- Use core content words only (omit filler words like "a", "the", "is").
- For unknown proper nouns, alphanumeric codes, or abbreviations, fingerspell each character as a separate item.
- No prose, no markdown.

Text: "${text}"
Output:`;

  try {
    const raw = await callWatsonx(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in gloss response");
    return JSON.parse(match[0]) as string[];
  } catch {
    // Fallback: uppercase each word.
    return text
      .toUpperCase()
      .split(/\s+/)
      .filter(Boolean);
  }
}
