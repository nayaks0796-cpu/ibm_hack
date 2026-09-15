"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
import { applyUiLanguage, t } from "@/lib/i18n";
import { PLAYBOOKS, playbookGoal, playbookTitle } from "@/lib/playbooks";
import {
  clearCurrentTranscript,
  factsForPlaybook,
  loadFacts,
  loadProfile,
  saveCallSession,
  saveProfile,
} from "@/lib/store";
import { RoomTransport } from "@/lib/transport/RoomTransport";
import type { Playbook, UiLanguage } from "@/lib/types";

export default function StartPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [playbookId, setPlaybookId] = useState("power-cut");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [islAvatar, setIslAvatar] = useState(true);
  const [userBrief, setUserBrief] = useState("");

  useEffect(() => {
    const profile = loadProfile();
    if (!profile.name.trim()) {
      router.replace("/setup");
      return;
    }
    setName(profile.name);
    setUiLanguage(profile.uiLanguage);
    setIslAvatar(profile.islAvatar);
    applyUiLanguage(profile.uiLanguage);
    const initial =
      PLAYBOOKS.find((item) => item.id === "power-cut") ?? PLAYBOOKS[0];
    setFacts(
      factsForPlaybook(
        initial.facts.map((fact) => fact.key),
        loadFacts()
      )
    );
    setReady(true);
  }, [router]);

  const playbook: Playbook =
    PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0];

  function selectPlaybook(id: string) {
    const next = PLAYBOOKS.find((item) => item.id === id) ?? PLAYBOOKS[0];
    setPlaybookId(next.id);
    setEditingKey(null);
    // Prefill from remembered facts for this playbook; keep in-progress edits
    // for keys that also appear on the new playbook.
    setFacts((current) =>
      factsForPlaybook(
        next.facts.map((fact) => fact.key),
        { ...loadFacts(), ...current }
      )
    );
  }

  function beginEdit(key: string) {
    setEditingKey(key);
    setDraft(facts[key] ?? "");
  }

  function commitEdit() {
    if (!editingKey) return;
    setFacts((current) => ({
      ...current,
      [editingKey]: draft.trim(),
    }));
    setEditingKey(null);
  }

  async function startCall() {
    const profile = loadProfile();
    const nextProfile = { ...profile, islAvatar };
    saveProfile(nextProfile);
    const callFacts = factsForPlaybook(
      playbook.facts.map((fact) => fact.key),
      facts
    );
    clearCurrentTranscript();
    saveCallSession({
      playbookId: playbook.id,
      startedAt: Date.now(),
      callLanguage: profile.callLanguage,
      pinnedReferenceNumber: null,
      facts: callFacts,
      islAvatar,
      userBrief: userBrief.trim(),
    });
    void RoomTransport.requestMicAccess().catch(() => {
      // Call page will offer Allow microphone and keep the typed clerk line.
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
              onClick={() => selectPlaybook(item.id)}
              className={`choice h-full p-5 text-left ${
                playbookId === item.id ? "choice-on" : ""
              }`}
            >
              <span className="block font-serif text-2xl">{playbookTitle(item, uiLanguage)}</span>
              <span className="mt-2 block text-sm font-normal text-[var(--muted)]">
                {playbookGoal(item, uiLanguage)}
              </span>
            </button>
          ))}
        </div>

        <section className="mt-8">
          <h2 className="eyebrow">{t("start.isl_avatar")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("start.isl_hint")}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIslAvatar(true)}
              className={`choice min-h-16 ${islAvatar ? "choice-on" : ""}`}
            >
              {t("setup.isl_on")}
            </button>
            <button
              type="button"
              onClick={() => setIslAvatar(false)}
              className={`choice min-h-16 ${!islAvatar ? "choice-on" : ""}`}
            >
              {t("setup.isl_off")}
            </button>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="eyebrow">{t("start.confirm_facts")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("start.facts_hint")}</p>
          <div className="mt-4 flex flex-col gap-2">
            {playbook.facts.map((fact) => {
              const value = facts[fact.key] ?? "";
              const label = fact.label[uiLanguage] ?? fact.label.en ?? fact.key;
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

        {/* Autonomous AI Relay Pre-Call Briefing Card */}
        <section className="mt-8 rounded-2xl border border-[var(--border)] bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/10 text-base text-teal-400">
              🤖
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">
                {uiLanguage === "hi" ? "AI रिले एजेंट ब्रीफिंग (Auto-Pilot Brief)" : "AI Relay Agent Briefing (Auto-Pilot Brief)"}
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {uiLanguage === "hi"
                  ? "कॉल शुरू होने से पहले अपने शब्दों में बताएं कि क्या बोलना है। आपका AI एजेंट अपने आप यह बात ऑपरेटर से कहेगा।"
                  : "Brief what to speak about before the call starts. Your autonomous AI agent will speak this automatically upon connection."}
              </p>
            </div>
          </div>
          <textarea
            value={userBrief}
            onChange={(e) => setUserBrief(e.target.value)}
            rows={3}
            placeholder={
              uiLanguage === "hi"
                ? "उदा: 'इन्दिरा नगर 2nd स्टेज में दोपहर 2 बजे से बिजली कटी है, मीटर 994021। घर में मरीज है, तत्काल ठीक कराएं।'"
                : "e.g. 'Report power outage in Sector 4 since 2 PM, meter 994021. Medical equipment in use, please expedite.'"
            }
            className="field mt-3 w-full text-sm resize-none rounded-xl"
          />
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
