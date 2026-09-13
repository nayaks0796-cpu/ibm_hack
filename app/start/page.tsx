// Start a call screen (route: /start)
// Situation cards, confirm/edit facts, Call button.
export default function StartPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">Start a Call</h1>
      <p className="text-gray-500 text-sm">
        {/* TODO: step 2 — clickable skeleton */}
        Choose a situation and confirm your facts, then press Call.
      </p>
    </main>
  );
}
