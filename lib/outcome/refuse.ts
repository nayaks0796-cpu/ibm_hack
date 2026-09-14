// Conservative clerk-refusal detector. Do not treat OTP warnings as a refusal.

const ENGLISH =
  /\b(cannot (help|register|do|process|assist)|can'?t (help|register|do)|we cannot|we can'?t|not possible|unable to|refused|we don'?t (handle|register)|cannot be registered)\b/i;

const HINDI =
  /नहीं (कर सकते|हो सकता|होगा|कर पाएंगे)|मना कर|संभव नहीं|अस्वीकार|हम नहीं कर/;

export function detectRefusal(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return false;
  if (ENGLISH.test(cleaned)) return true;
  if (HINDI.test(cleaned)) return true;
  return false;
}
