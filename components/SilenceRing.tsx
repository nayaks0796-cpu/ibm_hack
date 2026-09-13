// SilenceRing — visual indicator showing whether the line is active, silent, or disconnected.
// A deaf user cannot hear hold music, so this ring is critical for awareness.

export type RingState = "active" | "silent" | "disconnected";

const styles: Record<RingState, string> = {
  active: "text-emerald-600 border-emerald-600 bg-emerald-100",
  silent: "text-amber-600 border-amber-500 bg-amber-100",
  disconnected: "text-red-700 border-red-600 bg-red-100",
};

export default function SilenceRing({
  state = "disconnected",
}: {
  state?: RingState;
}) {
  return (
    <span
      className={`relative inline-flex h-8 w-8 items-center justify-center ${
        state === "active" ? "setu-ring-pulse" : ""
      }`}
      aria-label={`Line ${state}`}
      title={`Line ${state}`}
    >
      <span
        className={`h-5 w-5 rounded-full border-[3px] ${styles[state]}`}
      />
    </span>
  );
}
