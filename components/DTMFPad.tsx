// DTMFPad — numeric keypad for entering DTMF tones during a call (IVR menus, extensions).
// Sends tones via AudioTransport; logs as { side: "us", source: "dtmf" } in transcript.
// TODO: step 10 — implement DTMF tone sending
export default function DTMFPad() {
  const keys = ["1","2","3","4","5","6","7","8","9","*","0","#"];
  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {keys.map((k) => (
        <button
          key={k}
          className="rounded border border-gray-300 py-3 text-lg font-mono"
        >
          {k}
        </button>
      ))}
    </div>
  );
}
