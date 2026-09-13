// UnmuteButton — lets the user speak directly on the call.
// When pressed: cancels any playing TTS instantly (barge-in), captures user speech,
// captions it into the transcript as { side: "us", source: "user-voice" }.
// The LLM treats it as already-said; it never repeats the user's words.
// All audio goes through AudioTransport — this component NEVER touches the mic directly.
// TODO: step 5 — wire barge-in cancel + mic capture via AudioTransport
export default function UnmuteButton() {
  return (
    <button
      className="rounded-full bg-blue-600 text-white px-6 py-3 text-sm font-semibold"
      aria-label="Unmute and speak"
    >
      Unmute
    </button>
  );
}
