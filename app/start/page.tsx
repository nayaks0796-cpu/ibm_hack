"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { POWER_CUT } from "@/lib/playbooks";
import {
  clearCurrentTranscript,
  loadFacts,
  loadProfile,
  saveCallSession,
  saveFacts,
} from "@/lib/store";

export default function StartPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const profile = loadProfile();
    if (!profile.name.trim()) {
      router.replace("/");
      return;
    }
    setName(profile.name);
    setFacts(loadFacts());
    setReady(true);
  }, [router]);

  function beginEdit(key: string) {
    setEditingKey(key);
    setDraft(facts[key] ?? "");
  }

  function commitEdit() {
    if (!editingKey) return;
    const next = { ...facts, [editingKey]: draft.trim() };
    setFacts(next);
    saveFacts(next);
    setEditingKey(null);
  }

  function startCall() {
    const profile = loadProfile();
    clearCurrentTranscript();
    saveCallSession({
      playbookId: POWER_CUT.id,
      startedAt: Date.now(),
      callLanguage: profile.callLanguage,
      pinnedReferenceNumber: null,
    });
    router.push("/call");
  }

  if (!ready) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--setu-forest)]">
        {t("app.title")}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">
        {t("start.greeting", { name })}
      </h1>
      <p className="mt-2 text-base text-[var(--setu-muted)]">
        {t("start.choose_situation")}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          className="rounded-3xl border-2 border-[var(--setu-forest)] bg-[var(--setu-card)] p-5 text-left"
        >
          <span className="block text-2xl font-bold">{t("start.power_cut")}</span>
          <span className="mt-2 block text-base text-[var(--setu-muted)]">
            {POWER_CUT.goal.en}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <DisabledCard title={t("start.bank_1930")} />
          <DisabledCard title={t("start.hospital")} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--setu-muted)]">
          {t("start.confirm_facts")}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {POWER_CUT.facts.map((fact) => {
            const value = facts[fact.key] ?? "";
            const label = fact.label.en ?? fact.key;
            if (editingKey === fact.key) {
              return (
                <label key={fact.key} className="flex flex-col gap-2">
                  <span className="text-sm font-semibold">{label}</span>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit();
                      }
                    }}
                    className="min-h-14 rounded-2xl border border-[var(--setu-forest)] bg-[var(--setu-card)] px-4 text-lg"
                  />
                </label>
              );
            }
            return (
              <button
                key={fact.key}
                type="button"
                onClick={() => beginEdit(fact.key)}
                className="flex min-h-14 items-center justify-between rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] px-4 text-left"
              >
                <span className="text-sm text-[var(--setu-muted)]">{label}</span>
                <span className="text-base font-semibold">
                  {value || t("start.fact_empty")}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={startCall}
        className="mt-8 min-h-[4.5rem] rounded-3xl bg-[var(--setu-forest)] text-2xl font-bold text-white"
      >
        {t("start.call_button")}
      </button>

      <Link
        href="/"
        className="mt-4 min-h-12 text-center text-base font-semibold text-[var(--setu-forest)] underline-offset-4 hover:underline"
      >
        {t("start.edit_setup")}
      </Link>
    </main>
  );
}

function DisabledCard({ title }: { title: string }) {
  return (
    <div
      aria-disabled="true"
      className="rounded-3xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-4 opacity-50"
    >
      <p className="text-lg font-bold">{title}</p>
    </div>
  );
}
