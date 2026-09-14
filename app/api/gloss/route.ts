// POST /api/gloss  body: { text: string }
// Returns: { gloss: string[] }  — catalog-aligned English uppercase words.
// Unknown leftover words are fingerspelled (each character as a separate item).
import { NextRequest, NextResponse } from "next/server";
import { gloss } from "@/lib/watsonx/llama";

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text?: string };
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const glossArray = await gloss(text);
  return NextResponse.json({ gloss: glossArray });
}
