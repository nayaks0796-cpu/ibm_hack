"use client";

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
  const headline =
    outcome.referenceNumber ??
    outcome.capturedAnswer ??
    (outcome.result === "resolved" ? t("outcome.help_dispatched") : "—");
  const headlineLabel = outcome.referenceNumber
    ? t("outcome.reference")
    : t("outcome.answer");
  const resultLabel = t(RESULT_KEY[outcome.result]);

  return (
    <div className="flex w-full flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] bg-raised p-7 shadow-card">
      <p className="eyebrow">{headlineLabel}</p>
      <p className="font-serif text-5xl tracking-[-0.03em]">{headline}</p>

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
