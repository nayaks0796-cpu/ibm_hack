// Reference-number detector — identifies complaint/ticket/reference numbers in captions.
// Patterns: [A-Z]{2,6}[-/ ]?\d{4,12}  or  standalone 6–13 digit numbers near
// complaint/शिकायत/reference/ticket/registration.
// TODO: step 7 — wire into caption feed for pin confirmation banner

const ALPHANUM_PATTERN = /\b[A-Z]{2,6}[-/ ]?\d{4,12}\b/g;
const KEYWORD_DIGIT_PATTERN =
  /(?:complaint|शिकायत|reference|ticket|registration)\D{0,20}(\d{6,13})/gi;

/**
 * Returns all reference numbers found in text, or an empty array.
 */
export function detectReferenceNumbers(text: string): string[] {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  ALPHANUM_PATTERN.lastIndex = 0;
  while ((m = ALPHANUM_PATTERN.exec(text)) !== null) seen.add(m[0]);

  KEYWORD_DIGIT_PATTERN.lastIndex = 0;
  while ((m = KEYWORD_DIGIT_PATTERN.exec(text)) !== null) seen.add(m[1]);

  const results: string[] = [];
  seen.forEach((v) => results.push(v));
  return results;
}
