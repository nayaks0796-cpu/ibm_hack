"use client";

import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Outcome } from "@/lib/types";

const RESULT_KEY = {
  resolved: "outcome.result.resolved",
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
  const resultLabel = t(RESULT_KEY[outcome.result]);

  return (
    <div className="flex w-full max-w-md flex-col gap-5 rounded-3xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-6 shadow-[0_16px_40px_rgba(20,24,31,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--setu-muted)]">
        {t("outcome.reference")}
      </p>
      <p className="text-4xl font-bold tracking-wide text-[var(--setu-ink)]">
        {outcome.referenceNumber ?? "—"}
      </p>

      <div className="grid grid-cols-1 gap-3">
        <MetaRow
          label={t("outcome.result_label")}
          value={
            <span
              className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold ${
                outcome.result === "resolved"
                  ? "bg-[#d8f3e8] text-[var(--setu-forest-ink)]"
                  : "bg-[#f3e6d8] text-[var(--setu-clay)]"
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

      <details className="rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-paper)] px-4 py-3">
        <summary className="cursor-pointer text-base font-semibold text-[var(--setu-ink)]">
          {t("outcome.view_transcript")}
        </summary>
        <ol className="mt-3 flex flex-col gap-3">
          {outcome.transcript.map((entry, index) => (
            <li key={`${entry.t}-${index}`} className="text-base leading-snug">
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--setu-muted)]">
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
    <div className="flex items-center justify-between gap-4 border-b border-[var(--setu-line)] py-2 last:border-b-0">
      <span className="text-sm text-[var(--setu-muted)]">{label}</span>
      <span className="text-right text-base font-semibold">{value}</span>
    </div>
  );
}
