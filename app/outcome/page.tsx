// Outcome card screen (route: /outcome)
// Reference number, result, playbook name, duration.
// Full transcript hidden behind "View full conversation" (collapsed by default).
export default function OutcomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">Call Outcome</h1>
      <p className="text-gray-500 text-sm">
        {/* TODO: step 2 — clickable skeleton */}
        Reference number and result will appear here after the call ends.
      </p>
    </main>
  );
}
