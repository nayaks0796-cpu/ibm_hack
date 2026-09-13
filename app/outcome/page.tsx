"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OutcomeCard from "@/components/OutcomeCard";
import { t } from "@/lib/i18n";
import { getPlaybook, playbookTitle } from "@/lib/playbooks";
import { clearCallSession, loadLastOutcome } from "@/lib/store";
import type { Outcome } from "@/lib/types";

export default function OutcomePage() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOutcome(loadLastOutcome());
    setReady(true);
  }, []);

  function newCall() {
    clearCallSession();
    router.push("/start");
  }

  if (!ready) {
    return <main className="min-h-screen" />;
  }

  const playbook = outcome ? getPlaybook(outcome.playbookId) : null;
  const title = playbook ? playbookTitle(playbook) : outcome?.playbookId ?? "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--setu-forest)]">
        {t("app.title")}
      </p>
      <h1 className="mt-2 text-3xl font-bold">{t("outcome.title")}</h1>

      {outcome ? (
        <div className="mt-8 w-full">
          <OutcomeCard outcome={outcome} playbookTitle={title} />
        </div>
      ) : (
        <p className="mt-8 text-base text-[var(--setu-muted)]">
          {t("outcome.no_outcome")}
        </p>
      )}

      <button
        type="button"
        onClick={newCall}
        className="mt-8 min-h-16 w-full max-w-md rounded-2xl bg-[var(--setu-ink)] text-lg font-bold text-[var(--setu-paper)]"
      >
        {t("outcome.new_call")}
      </button>
    </main>
  );
}
