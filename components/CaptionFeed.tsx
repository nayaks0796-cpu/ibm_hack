// CaptionFeed — displays live captions from clerk (STT) and from us (TTS-sent / user-voice).
// Renders TranscriptEntry[] in chronological order.
// "clerk" entries come from ElevenLabs Scribe (or Watson backup); "us" entries from TTS/unmute.
// TODO: step 2 — render static transcript; step 4 — wire live Scribe captions
export default function CaptionFeed() {
  return (
    <div className="w-full flex flex-col gap-2 p-4 overflow-y-auto">
      {/* transcript entries rendered here */}
    </div>
  );
}
