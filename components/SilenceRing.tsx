// SilenceRing — visual indicator showing whether the line is active, silent, or disconnected.
// A deaf user cannot hear hold music, so this ring is critical for awareness.
// States: "active" | "silent" | "disconnected"
// TODO: step 2 — static ring; step 4 — wire to AudioTransport signal
export type RingState = "active" | "silent" | "disconnected";

const colours: Record<RingState, string> = {
  active: "bg-green-400",
  silent: "bg-yellow-400",
  disconnected: "bg-red-400",
};

export default function SilenceRing({ state = "disconnected" }: { state?: RingState }) {
  return (
    <div
      className={`w-4 h-4 rounded-full ${colours[state]}`}
      aria-label={`Line ${state}`}
      title={`Line ${state}`}
    />
  );
}
