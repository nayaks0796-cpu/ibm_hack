// POST /api/gloss  body: { text: string }
// Returns: { gloss: string[] }  — English uppercase words for the ISL avatar.
// Unknown words are fingerspelled.
import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  // TODO: step 9 — call Llama gloss() helper, return ISL gloss array
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
