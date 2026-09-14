"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
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
    return <main className="min-h-screen bg-paper" />;
  }

  const playbook = outcome ? getPlaybook(outcome.playbookId) : null;
  const title = playbook ? playbookTitle(playbook) : outcome?.playbookId ?? "";

  return (
    <AppChrome>
      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-6 pb-20">
        <p className="eyebrow animate-fade-up">{t("app.title")}</p>
        <h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] animate-fade-up">
          {t("outcome.title")}
        </h1>

        {outcome ? (
          <div className="mt-10 w-full animate-fade-up [animation-delay:80ms]">
            <OutcomeCard outcome={outcome} playbookTitle={title} />
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
