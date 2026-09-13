// POST /api/suggest
// body: { caption: string, history: TranscriptEntry[], facts: Record<string,string>, goal: string, callLanguage: "hi"|"en" }
// Returns: { suggestions: Array<{ id: string, label: string, sentence: string }> }
// label = UI language (short button text), sentence = call language (exact TTS text).
import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  // TODO: step 6 — call Llama 3.3 70B on IBM watsonx.ai, return 3-5 reply suggestions
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
