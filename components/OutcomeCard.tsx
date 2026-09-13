// OutcomeCard — shows ONE card after the call ends.
// Reference number on top, result (resolved/refused/no-answer/incomplete), playbook name, duration.
// Full transcript hidden behind collapsed "View full conversation" — NOT the default view.
// Saved to device (localStorage/IndexedDB). No server-side storage.
// TODO: step 2 — render static outcome; step 7 — apply redaction to transcript display
export default function OutcomeCard() {
  return (
    <div className="w-full max-w-md rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
      <p className="text-2xl font-bold tracking-wide">—</p>
      {/* reference number, result, playbook, duration */}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-gray-500">
          View full conversation
        </summary>
        {/* redacted transcript rendered here */}
      </details>
    </div>
  );
}
