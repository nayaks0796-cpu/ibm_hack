// ReplySuggestions — shows 3-5 LLM reply suggestions plus the 4 always-present ones.
// Always-present: Wait / Please repeat / I did not understand / Please give the complaint number.
// User taps a suggestion → sees exact sentence → taps Send → TTS speaks.
// NEVER auto-sends. NEVER called "chips" anywhere.
// TODO: step 2 — static always-present suggestions; step 6 — LLM suggestions wired
export default function ReplySuggestions() {
  return (
    <div className="w-full flex flex-wrap gap-2 p-4">
      {/* reply suggestion buttons rendered here */}
    </div>
  );
}
