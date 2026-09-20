"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppChrome from "@/components/AppChrome";
import OutcomeCard from "@/components/OutcomeCard";
import { formatCallDate, formatDuration } from "@/lib/format";
import { applyUiLanguage, getUiLanguage, t } from "@/lib/i18n";
import { getPlaybook, playbookTitle } from "@/lib/playbooks";
import { clearOutcomes, loadOutcomes, loadProfile } from "@/lib/store";
import type { Outcome, OutcomeResult } from "@/lib/types";

const RESULT_BADGE: Record<OutcomeResult, { label: string; cls: string }> = {
  resolved: { label: "history.result.resolved", cls: "bg-signal/15 text-signal" },
  answered: { label: "history.result.answered", cls: "bg-signal/15 text-signal" },
  refused: { label: "history.result.refused", cls: "bg-danger/15 text-danger" },
  "no-answer": { label: "history.result.no_answer", cls: "bg-highlight/20 text-highlight-ink" },
  incomplete: { label: "history.result.incomplete", cls: "bg-highlight/20 text-highlight-ink" },
};

export default function HistoryPage() {
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyUiLanguage(loadProfile().uiLanguage);
    // Show most-recent first
    setOutcomes([...loadOutcomes()].reverse());
    setReady(true);
  }, []);

  function handleClear() {
    if (!window.confirm(t("history.clear_confirm"))) return;
    clearOutcomes();
    setOutcomes([]);
    setExpandedIndex(null);
  }

  if (!ready) {
    return <main className="min-h-screen bg-paper" />;
  }

  const uiLanguage = getUiLanguage();

  return (
    <AppChrome
      aside={
        <Link
          href="/start"
          className="text-sm font-semibold text-[var(--muted)] transition-colors hover:text-ink"
        >
          ← {t("history.back")}
        </Link>
      }
    >
      <main className="mx-auto w-full max-w-2xl px-6 pb-20 sm:px-10">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="eyebrow animate-fade-up">{t("app.title")}</p>
            <h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] animate-fade-up">
              {t("history.title")}
            </h1>
          </div>
          {outcomes.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-danger"
            >
              {t("history.clear")}
            </button>
          )}
        </div>

        {outcomes.length === 0 ? (
          <p className="mt-12 text-center text-base text-[var(--muted)]">
            {t("history.empty")}
          </p>
        ) : (
          <ol className="mt-10 flex flex-col gap-4">
            {outcomes.map((outcome, index) => {
              const playbook = getPlaybook(outcome.playbookId);
              const title = playbook
                ? playbookTitle(playbook, uiLanguage)
                : outcome.playbookId;
              const badge = RESULT_BADGE[outcome.result];
              const isExpanded = expandedIndex === index;

              return (
                <li key={`${outcome.startedAt}-${index}`} className="animate-fade-up" style={{ animationDelay: `${index * 40}ms` }}>
                  {/* Summary row — always visible */}
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    className="w-full rounded-[1.5rem] border border-[var(--border)] bg-raised px-5 py-4 text-left shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{title}</p>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">
                          {formatCallDate(outcome.startedAt)}
                          {" · "}
                          {formatDuration(outcome.startedAt, outcome.endedAt)}
                        </p>
                        {outcome.referenceNumber && (
                          <p className="mt-1 font-mono text-sm font-semibold text-signal">
                            {outcome.referenceNumber}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}
                      >
                        {t(badge.label as Parameters<typeof t>[0])}
                      </span>
                    </div>
                  </button>

                  {/* Expanded OutcomeCard */}
                  {isExpanded && (
                    <div className="mt-2 px-1">
                      <OutcomeCard outcome={outcome} playbookTitle={title} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-10">
          <Link href="/start" className="gold-btn inline-flex min-h-14 items-center px-8 text-lg">
            {t("outcome.new_call")}
          </Link>
        </div>
      </main>
    </AppChrome>
  );
}
