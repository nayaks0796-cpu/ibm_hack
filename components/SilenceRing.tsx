export type RingState = "active" | "silent" | "disconnected" | "ringing";

const styles: Record<RingState, string> = {
  active: "bg-signal",
  silent: "bg-highlight",
  disconnected: "bg-danger",
  ringing: "bg-highlight",
};

export default function SilenceRing({
  state = "disconnected",
}: {
  state?: RingState;
}) {
  return (
    <span
      className="relative inline-flex h-8 w-8 items-center justify-center"
      aria-label={`Line ${state}`}
      title={`Line ${state}`}
    >
      {state === "active" ? (
        <span className="absolute inset-0 rounded-full border border-signal/50 animate-soft-pulse" />
      ) : null}
      {state === "ringing" ? (
        <span className="absolute inset-0 rounded-full border border-highlight/70 animate-soft-pulse" />
      ) : null}
      <span className={`h-2.5 w-2.5 rounded-full ${styles[state]}`} />
    </span>
  );
}
