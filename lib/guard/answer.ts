import { SENSITIVE_TRIGGER } from "./otp";

const ANSWER_HINT =
  /\b(yes|no|available|not available|ready|not ready|friday|monday|tuesday|wednesday|thursday|saturday|sunday|approved|rejected|dispatched|on the way|coming|bed|status|tomorrow|today)\b/i;
const ANSWER_HINT_HI =
  /हाँ|हां|नहीं|उपलब्ध|तैयार|मंजूर|भेजा|आ रहे|बेड|स्थिति|कल|आज/;

/** Short clerk lines that look like the answer to a status/info call. */
export function looksLikeGoalAnswer(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 180) return false;
  if (SENSITIVE_TRIGGER && new RegExp(SENSITIVE_TRIGGER, "i").test(trimmed)) {
    return false;
  }
  return ANSWER_HINT.test(trimmed) || ANSWER_HINT_HI.test(trimmed);
}

export function answerPreview(text: string): string {
  const compact = text.trim().replace(/\s+/g, " ");
  return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
}
