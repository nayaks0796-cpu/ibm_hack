export default function HeroConsole() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] animate-fade-up [animation-delay:180ms]">
      <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(14,124,114,0.12),transparent_62%)]" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-raised shadow-card">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Live call
            </p>
            <p className="text-sm font-medium">Electricity board · 02:14</p>
          </div>
          <span className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-highlight-ink/50 animate-soft-pulse" />
            <span className="h-2.5 w-2.5 rounded-full bg-signal" />
          </span>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            They said
          </p>
          <p className="font-serif text-2xl leading-snug">
            मैं आपकी कैसे सहायता कर सकता हूँ?
          </p>

          <div className="flex h-10 items-end gap-1">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="w-1 origin-bottom rounded-full bg-highlight-ink/70 animate-bar"
                style={{
                  height: `${10 + ((i * 17) % 22)}px`,
                  animationDelay: `${i * 70}ms`,
                }}
              />
            ))}
          </div>

          <div className="rounded-2xl bg-paper px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              You told Setu
            </p>
            <p className="mt-1 text-sm font-semibold">Ask for the complaint number</p>
          </div>

          <div className="rounded-2xl bg-signal/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">
              Setu replies · Hindi
            </p>
            <p className="mt-1 text-base font-medium">
              कृपया शिकायत संख्या बताइए।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
