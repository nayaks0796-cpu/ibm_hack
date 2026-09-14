"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
import { t } from "@/lib/i18n";
import { PLAYBOOKS, playbookGoal, playbookTitle } from "@/lib/playbooks";
import {
  clearCurrentTranscript,
  loadFacts,
  loadProfile,
  saveCallSession,
  saveFacts,
} from "@/lib/store";
import type { Playbook } from "@/lib/types";

export default function StartPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [playbookId, setPlaybookId] = useState("power-cut");

  useEffect(() => {
    const profile = loadProfile();
    if (!profile.name.trim()) {
      router.replace("/setup");
      return;
    }
    setName(profile.name);
    setFacts(loadFacts());
    setReady(true);
  }, [router]);

  const playbook: Playbook =
    PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0];

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
      playbookId: playbook.id,
      startedAt: Date.now(),
      callLanguage: profile.callLanguage,
      pinnedReferenceNumber: null,
    });
    router.push("/call");
  }

  if (!ready) {
    return <main className="min-h-screen bg-paper" />;
  }

  return (
    <AppChrome
      aside={
        <Link href="/setup" className="text-sm font-semibold text-[var(--muted)] transition-colors hover:text-ink">
          {t("start.edit_setup")}
        </Link>
      }
    >
      <main className="mx-auto w-full max-w-3xl px-6 pb-20 sm:px-10">
        <p className="eyebrow animate-fade-up">{t("start.title")}</p>
        <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-[-0.03em] animate-fade-up sm:text-6xl">
          {t("start.greeting", { name })}
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)] animate-fade-up [animation-delay:60ms]">
          {t("start.choose_situation")}
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {PLAYBOOKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlaybookId(item.id)}
              className={`choice h-full p-5 text-left ${
                playbookId === item.id ? "choice-on" : ""
              }`}
            >
              <span className="block font-serif text-2xl">{playbookTitle(item)}</span>
              <span className="mt-2 block text-sm font-normal text-[var(--muted)]">
                {playbookGoal(item)}
              </span>
            </button>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="eyebrow">{t("start.confirm_facts")}</h2>
          <div className="mt-4 flex flex-col gap-2">
            {playbook.facts.map((fact) => {
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
                      className="field"
                    />
                  </label>
                );
              }
              return (
                <button
                  key={fact.key}
                  type="button"
                  onClick={() => beginEdit(fact.key)}
                  className="choice flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-[var(--muted)]">{label}</span>
                  <span>{value || t("start.fact_empty")}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-10 flex justify-end">
          <button type="button" onClick={startCall} className="gold-btn min-h-16 px-12 text-xl">
            {t("start.call_button")}
          </button>
        </div>
      </main>
    </AppChrome>
  );
}
