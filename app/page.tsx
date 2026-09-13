// Setup screen (route: /)
// One-time user setup: name, saved facts, UI language, call language, voice, ISL avatar toggle.
export default function SetupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">Setu Setup</h1>
      <p className="text-gray-500 text-sm">
        {/* TODO: step 2 — clickable skeleton */}
        Setup screen placeholder. Enter your name and facts here.
      </p>
    </main>
  );
}
