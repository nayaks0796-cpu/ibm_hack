import BrandMark from "@/components/BrandMark";
import HeroConsole from "@/components/landing/HeroConsole";
import LandingCta from "@/components/landing/LandingCta";
import { t } from "@/lib/i18n";

const STEPS = [
  {
    n: "01",
    title: "Confirm the facts you already have",
    body: "Name, consumer number, area — only what you typed. Sampark will not invent a number or a name.",
  },
  {
    n: "02",
    title: "Read every word",
    body: "The clerk’s voice becomes live captions. A silence ring shows whether the line is active, quiet, or gone.",
  },
  {
    n: "03",
    title: "Tap a reply. Then Send.",
    body: "Nothing is spoken until you approve the exact sentence. OTP, PIN, CVV and passwords are never spoken.",
  },
];

const TIMELINE = [
  { t: "00:00", title: "You press Call", body: "Sampark opens the line. The first sentence names you as an assistive relay." },
  { t: "00:18", title: "The clerk is captioned", body: "You read the line, tap a reply suggestion, and press Send." },
  { t: "02:46", title: "Complaint number received", body: "Pin it when you hear it. The outcome card keeps that number on top." },
];

export default function LandingPage() {
  return (
    <div className="bg-paper text-ink">
      <header className="fixed top-0 left-0 z-50 hidden items-center gap-5 p-7 md:flex">
        <BrandMark />
      </header>

      <nav className="text-[var(--muted)] fixed top-0 right-0 z-50 flex items-center gap-7 p-7 text-base">
        <a href="#how-it-works" className="hidden transition-colors duration-200 hover:text-ink sm:block">
          {t("land.how")}
        </a>
        <a href="#why" className="hidden transition-colors duration-200 hover:text-ink sm:block">
          {t("land.why")}
        </a>
        <LandingCta label={t("land.try")} className="gold-btn min-h-11 px-5 text-sm" />
      </nav>

      <main>
        <section className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-6 pt-28 pb-16 sm:px-10 lg:px-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_20%,rgba(14,124,114,0.13),transparent_24%),radial-gradient(circle_at_25%_75%,rgba(242,183,5,0.07),transparent_30%)]" />
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-16 left-1/2 h-[680px] w-[1200px] -translate-x-1/2 opacity-70"
            viewBox="0 0 1200 680"
            fill="none"
          >
            <path
              d="M-80 420C150 120 290 650 560 360S925 80 1280 310"
              stroke="#8a5a00"
              strokeWidth="1.2"
              strokeDasharray="6 10"
              opacity="0.3"
              className="animate-wave"
            />
            <path
              d="M-50 510C190 250 330 710 640 440S980 230 1240 170"
              stroke="#0e7c72"
              strokeWidth="1"
              opacity="0.18"
              strokeDasharray="6 10"
              className="animate-wave [animation-duration:7s]"
            />
          </svg>

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="md:hidden">
              <BrandMark />
            </div>
            <div className="animate-fade-up">
              <p className="eyebrow">{t("land.eyebrow")}</p>
              <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-7xl lg:text-[5.5rem]">
                {t("land.hero")}
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
                {t("land.hero_body")}
              </p>
              <div className="mt-8">
                <LandingCta label={t("land.cta")} />
              </div>
            </div>
            <HeroConsole />
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-[var(--border)] bg-raised px-6 py-24 sm:px-10 lg:px-16"
        >
          <div className="mx-auto max-w-7xl">
            <p className="eyebrow">{t("land.same_line")}</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("land.lead")}
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">{t("land.lead_body")}</p>
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <article
                  key={step.n}
                  className="rounded-3xl border border-[var(--border)] bg-paper p-6 transition-transform duration-300 hover:-translate-y-1"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <p className="font-serif text-3xl text-highlight-ink">{step.n}</p>
                  <h3 className="mt-4 font-serif text-2xl">{step.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-6 py-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <p className="eyebrow">{t("land.visible")}</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("land.shape")}
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">{t("land.shape_body")}</p>
            <ol className="mt-14 space-y-0">
              {TIMELINE.map((row) => (
                <li
                  key={row.t}
                  className="grid gap-4 border-t border-[var(--border)] py-8 md:grid-cols-[7rem_1fr] md:items-baseline"
                >
                  <p className="font-serif text-2xl text-highlight-ink">{row.t}</p>
                  <div>
                    <h3 className="text-xl font-semibold">{row.title}</h3>
                    <p className="mt-2 text-[var(--muted)]">{row.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="why" className="px-6 py-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <p className="eyebrow">{t("land.built")}</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("land.depend")}
            </h2>
            <ul className="mt-10 max-w-2xl space-y-4 text-lg leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                {t("land.why_1")}
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                {t("land.why_2")}
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                {t("land.why_3")}
              </li>
            </ul>
            <div className="mt-12">
              <LandingCta label={t("land.cta")} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <p className="text-sm text-[var(--muted)]">{t("land.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
