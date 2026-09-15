"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink">
      <p className="font-serif text-3xl">Sampark hit a snag.</p>
      <p className="max-w-md text-[var(--muted)]">Reload this screen to continue.</p>
      <button type="button" className="gold-btn min-h-11 px-5 text-sm" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
