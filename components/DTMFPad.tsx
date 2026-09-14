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
          className="choice min-h-14 font-mono text-xl"
        >
          {key}
        </button>
      ))}
    </div>
  );
}
