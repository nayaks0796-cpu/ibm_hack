"use client";

export default function DTMFPad({ onKey }: { onKey: (key: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          className="min-h-14 rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] text-xl font-mono font-semibold"
        >
          {key}
        </button>
      ))}
    </div>
  );
}
