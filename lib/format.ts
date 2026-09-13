export function formatDuration(startedAt: number, endedAt: number): string {
  const total = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function missingFactSentence(callLanguage: "hi" | "en"): string {
  return callLanguage === "hi"
    ? "मैं जाँच करके बताऊँगा।"
    : "I will check and tell you.";
}
