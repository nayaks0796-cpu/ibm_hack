"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Outcome } from "@/lib/types";

const RESULT_KEY = {
  resolved: "outcome.result.resolved",
  answered: "outcome.result.answered",
  refused: "outcome.result.refused",
  "no-answer": "outcome.result.no_answer",
  incomplete: "outcome.result.incomplete",
} as const;

export default function OutcomeCard({
  outcome,
  playbookTitle,
}: {
  outcome: Outcome;
  playbookTitle: string;
}) {
  const [copied, setCopied] = useState(false);

  const headline =
    outcome.referenceNumber ??
    outcome.capturedAnswer ??
    (outcome.result === "resolved" ? t("outcome.help_dispatched") : "—");
  const headlineLabel = outcome.referenceNumber
    ? t("outcome.reference")
    : t("outcome.answer");
  const resultLabel = t(RESULT_KEY[outcome.result]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(headline);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (e.g. non-secure context) — silent fail
    }
  }

  async function handleShare() {
    const text = [
      `Sampark call — ${playbookTitle}`,
      `Result: ${resultLabel}`,
      headline !== "—" ? `Reference / Answer: ${headline}` : null,
      `Duration: ${formatDuration(outcome.startedAt, outcome.endedAt)}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Sampark call outcome", text });
        return;
      } catch {
        // user cancelled or share unavailable — fall through to copy
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent fail
    }
  }

  return (
    <div className="flex w-full flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] bg-raised p-7 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{headlineLabel}</p>
          <p className="mt-1 font-serif text-5xl tracking-[-0.03em] break-all">{headline}</p>
        </div>
        {/* Copy + Share actions */}
        <div className="flex shrink-0 gap-2 pt-1">
          <button
            type="button"
            onClick={() => void handleCopy()}
            title={t("outcome.copy")}
            className="min-h-9 rounded-full border border-[var(--border)] bg-paper px-3 text-xs font-semibold transition-colors hover:border-signal hover:text-signal"
          >
            {copied ? t("outcome.copied") : t("outcome.copy")}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            title={t("outcome.share")}
            className="min-h-9 rounded-full border border-[var(--border)] bg-paper px-3 text-xs font-semibold transition-colors hover:border-signal hover:text-signal"
          >
            {t("outcome.share")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1">
        <MetaRow
          label={t("outcome.result_label")}
          value={
            <span
              className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold ${
                outcome.result === "resolved" || outcome.result === "answered"
                  ? "bg-signal/15 text-signal"
                  : "bg-highlight/20 text-highlight-ink"
              }`}
            >
              {resultLabel}
            </span>
          }
        />
        <MetaRow label={t("outcome.playbook")} value={playbookTitle} />
        <MetaRow
          label={t("outcome.duration")}
          value={formatDuration(outcome.startedAt, outcome.endedAt)}
        />
      </div>

      <details className="rounded-2xl border border-[var(--border)] bg-paper px-4 py-3">
        <summary className="cursor-pointer text-base font-semibold">
          {t("outcome.view_transcript")}
        </summary>
        <ol className="mt-3 flex flex-col gap-3">
          {outcome.transcript.map((entry, index) => (
            <li key={`${entry.t}-${index}`} className="text-base leading-snug">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {entry.side === "us" ? t("call.you") : t("call.clerk")}
              </span>
              {entry.text}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-3 last:border-b-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-right text-base font-semibold">{value}</span>
    </div>
  );
}
