// POST /api/suggest
// body: { caption: string, history: TranscriptEntry[], facts: Record<string,string>, goal: string, callLanguage: "hi"|"en" }
// Returns: { suggestions: Array<{ id: string, label: string, sentence: string }> }
// label = UI language (short button text), sentence = call language (exact TTS text).
import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/watsonx/llama";
import type { TranscriptEntry } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    caption: string;
    history: TranscriptEntry[];
    facts: Record<string, string>;
    goal: string;
    callLanguage: "hi" | "en";
  };

  const { caption = "", history = [], facts = {}, goal = "", callLanguage = "hi" } = body;

  const suggestions = await suggest(caption, history, facts, goal, callLanguage);
  return NextResponse.json({ suggestions });
}
