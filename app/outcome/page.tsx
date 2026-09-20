"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
import OutcomeCard from "@/components/OutcomeCard";
import RefusedOutcomeBanner from "@/components/RefusedOutcomeBanner";
import { applyUiLanguage, getUiLanguage, t } from "@/lib/i18n";
import { getPlaybook, playbookTitle } from "@/lib/playbooks";
import {
  clearCallSession,
  loadLastOutcome,
  loadProfile,
  mergeSavedFacts,
} from "@/lib/store";
import type { Outcome } from "@/lib/types";

export default function OutcomePage() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [ready, setReady] = useState(false);
  const [factsSaved, setFactsSaved] = useState(false);

  useEffect(() => {
    applyUiLanguage(loadProfile().uiLanguage);
    setOutcome(loadLastOutcome());
    setReady(true);
  }, []);

  function newCall() {
    clearCallSession();
    router.push("/start");
  }

  function saveFactsForNextTime() {
    if (!outcome?.facts) return;
    mergeSavedFacts(outcome.facts);
    setFactsSaved(true);
  }

  if (!ready) {
    return <main className="min-h-screen bg-paper" />;
  }

  const playbook = outcome ? getPlaybook(outcome.playbookId) : null;
  const title = playbook ? playbookTitle(playbook, getUiLanguage()) : outcome?.playbookId ?? "";
  const uiLanguage = getUiLanguage();
  const callFacts = outcome?.facts ?? {};
  const factRows =
    playbook?.facts
      .map((fact) => {
        const value = (callFacts[fact.key] ?? "").trim();
        if (!value) return null;
        return {
          key: fact.key,
          label: fact.label[uiLanguage] ?? fact.label.en ?? fact.key,
          value,
        };
      })
      .filter((row): row is { key: string; label: string; value: string } => row !== null) ??
    [];

  return (
    <AppChrome
      aside={
        <Link
          href="/history"
          className="text-sm font-semibold text-[var(--muted)] transition-colors hover:text-ink"
        >
          {t("history.title")}
        </Link>
      }
    >
      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-6 pb-20">
        <p className="eyebrow animate-fade-up">{t("app.title")}</p>
        <h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] animate-fade-up">
          {t("outcome.title")}
        </h1>

        {outcome ? (
          <div className="mt-10 w-full animate-fade-up [animation-delay:80ms]">
            {outcome.result === "refused" ? (
              <div className="mb-4">
                <RefusedOutcomeBanner lang={getUiLanguage()} />
              </div>
            ) : null}
            <OutcomeCard outcome={outcome} playbookTitle={title} />

            {factRows.length > 0 ? (
              <section className="mt-6 w-full">
                <h2 className="eyebrow">{t("outcome.facts_heading")}</h2>
                <ul className="mt-3 space-y-2">
                  {factRows.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2 text-sm"
                    >
                      <span className="text-[var(--muted)]">{row.label}</span>
                      <span className="text-right font-medium">{row.value}</span>
                    </li>
                  ))}
                </ul>
                {factsSaved ? (
                  <p className="mt-4 text-sm font-semibold text-[var(--muted)]">
                    {t("outcome.facts_saved")}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={saveFactsForNextTime}
                    className="choice mt-4 w-full min-h-14 text-base font-semibold"
                  >
                    {t("outcome.save_facts")}
                  </button>
                )}
              </section>
            ) : null}
          </div>
        ) : (
          <p className="mt-8 text-base text-[var(--muted)]">{t("outcome.no_outcome")}</p>
        )}

        <button type="button" onClick={newCall} className="gold-btn mt-10 min-h-14 w-full max-w-md text-lg">
          {t("outcome.new_call")}
        </button>
      </main>
    </AppChrome>
  );
}
