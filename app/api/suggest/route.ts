// POST /api/suggest
// body: { caption, history, facts, goal, callLanguage, uiLanguage }
// Returns: { suggestions: [{ id, label, sentence }] }
// label = UI language (short button). sentence = call language (exact TTS text).
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
    uiLanguage?: string;
  };

  const {
    caption = "",
    history = [],
    facts = {},
    goal = "",
    callLanguage = "hi",
    uiLanguage = "en",
  } = body;

  const suggestions = await suggest(
    caption,
    history,
    facts,
    goal,
    callLanguage,
    uiLanguage
  );
  return NextResponse.json({ suggestions });
}
