// Reference-number detector — complaint / ticket / reference numbers in captions.
// Tight letter+digit forms: COMP-4821, TICK123456.
// Standalone 6–13 digit numbers only after complaint/शिकायत/reference/ticket/registration.

const GLUED = /\b[A-Za-z]{2,6}\d{4,12}\b/g;
const SEPARATED = /\b[A-Za-z]{2,6}[-/]\d{4,12}\b/g;
const KEYWORD =
  /(?:complaint|शिकायत|reference|ticket|registration|संदर्भ|पंजीकरण)/i;
const KEYWORD_DIGITS =
  /(?:complaint|शिकायत|reference|ticket|registration|संदर्भ|पंजीकरण)\D{0,20}(\d{6,13})/gi;
const KEYWORD_SPACED = /\b[A-Za-z]{2,6}\s+\d{4,12}\b/g;

function normalize(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function detectReferenceNumbers(text: string): string[] {
  const seen = new Set<string>();

  GLUED.lastIndex = 0;
  SEPARATED.lastIndex = 0;
  for (const match of text.matchAll(SEPARATED)) seen.add(normalize(match[0]));
  for (const match of text.matchAll(GLUED)) seen.add(normalize(match[0]));

  if (KEYWORD.test(text)) {
    KEYWORD.lastIndex = 0;
    KEYWORD_DIGITS.lastIndex = 0;
    KEYWORD_SPACED.lastIndex = 0;
    for (const match of text.matchAll(KEYWORD_DIGITS)) {
      if (match[1]) seen.add(match[1]);
    }
    for (const match of text.matchAll(KEYWORD_SPACED)) {
      seen.add(normalize(match[0]));
    }
  }

  return [...seen];
}
