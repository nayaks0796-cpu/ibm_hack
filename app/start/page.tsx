"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
import { SpeakButton, spokenFieldValue, useSpeakToText } from "@/components/BriefMic";
import SpeakInput from "@/components/SpeakInput";
import { applyUiLanguage, t } from "@/lib/i18n";
import {
  PLAYBOOK_CATEGORIES,
  emergencyPlaybooks,
  getPlaybook,
  playbookGoal,
  playbookTitle,
  playbooksInCategory,
} from "@/lib/playbooks";
import {
  clearCurrentTranscript,
  factsForPlaybook,
  loadFacts,
  loadProfile,
  saveCallSession,
  saveProfile,
} from "@/lib/store";
import { RoomTransport } from "@/lib/transport/RoomTransport";
import type { CallLanguage, Playbook, PlaybookCategory, UiLanguage } from "@/lib/types";

const CATEGORY_KEY: Record<PlaybookCategory, "cat.emergency" | "cat.utility" | "cat.money" | "cat.health" | "cat.government" | "cat.legal"> = {
  emergency: "cat.emergency",
  utility: "cat.utility",
  money: "cat.money",
  health: "cat.health",
  government: "cat.government",
  legal: "cat.legal",
};

async function readGpsLocation(fallback: string): Promise<string> {
  if (!navigator.geolocation) return fallback;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), 2500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve(
          `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        );
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      },
      { enableHighAccuracy: false, timeout: 2200, maximumAge: 60_000 }
    );
  });
}

export default function StartPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<PlaybookCategory | null>(null);
  const [playbookId, setPlaybookId] = useState("power-cut");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [callLanguage, setCallLanguage] = useState<CallLanguage>("en");
  const [islAvatar, setIslAvatar] = useState(true);
  const [userBrief, setUserBrief] = useState("");
  const [sosBusy, setSosBusy] = useState(false);
  const [speakTarget, setSpeakTarget] = useState<string | null>(null);
  const [showMissingWarning, setShowMissingWarning] = useState(false);
  const speakTargetRef = useRef<string | null>(null);
  const firstFinalRef = useRef(true);

  const speak = useSpeakToText({
    callLanguage,
    name,
    facts,
    onTranscript: (text) => {
      const target = speakTargetRef.current;
      if (!target) return;
      if (target === "brief") {
        setUserBrief((current) => (current.trim() ? `${current.trim()} ${text}` : text));
        return;
      }
      setFacts((current) => {
        if (firstFinalRef.current) {
          firstFinalRef.current = false;
          return { ...current, [target]: text };
        }
        const prev = (current[target] ?? "").trim();
        return { ...current, [target]: prev ? `${prev} ${text}` : text };
      });
    },
  });

  function stopSpeak() {
    speak.stop();
    speakTargetRef.current = null;
    setSpeakTarget(null);
  }

  function toggleSpeak(target: string) {
    if (speakTargetRef.current === target && (speak.listening || speak.connecting)) {
      stopSpeak();
      return;
    }
    firstFinalRef.current = true;
    speakTargetRef.current = target;
    setSpeakTarget(target);
    speak.start();
  }

  useEffect(() => {
    const profile = loadProfile();
    if (!profile.name.trim()) {
      router.replace("/setup");
      return;
    }
    setName(profile.name);
    setUiLanguage(profile.uiLanguage);
    setCallLanguage(profile.callLanguage);
    setIslAvatar(profile.islAvatar);
    applyUiLanguage(profile.uiLanguage);
    const initial = getPlaybook("power-cut") ?? playbooksInCategory("utility")[0];
    if (initial) {
      setPlaybookId(initial.id);
      setFacts(
        factsForPlaybook(
          initial.facts.map((fact) => fact.key),
          loadFacts()
        )
      );
    }
    setReady(true);
  }, [router]);

  const playbook: Playbook =
    getPlaybook(playbookId) ?? getPlaybook("power-cut") ?? playbooksInCategory("utility")[0];
  const listed = category ? playbooksInCategory(category) : [];

  function selectPlaybook(id: string) {
    const next = getPlaybook(id);
    if (!next) return;
    setPlaybookId(next.id);
    setShowMissingWarning(false);
    stopSpeak();
    setFacts((current) =>
      factsForPlaybook(
        next.facts.map((fact) => fact.key),
        { ...loadFacts(), ...current, location: loadProfile().location ?? "" }
      )
    );
  }

  function beginSession(
    target: Playbook,
    callFacts: Record<string, string>,
    extra?: { autoSpeakOpener?: boolean; userBrief?: string }
  ) {
    stopSpeak();
    const profile = loadProfile();
    saveProfile({ ...profile, islAvatar });
    clearCurrentTranscript();
    saveCallSession({
      playbookId: target.id,
      startedAt: Date.now(),
      callLanguage: profile.callLanguage,
      pinnedReferenceNumber: null,
      pinnedAnswer: null,
      facts: callFacts,
      islAvatar,
      userBrief: extra?.userBrief ?? userBrief.trim(),
      autoSpeakOpener: extra?.autoSpeakOpener,
    });
    void RoomTransport.requestMicAccess().catch(() => undefined);
    router.push("/call");
  }

  function missingRequiredFacts(): string[] {
    return playbook.facts
      .filter((f) => f.required && !(facts[f.key] ?? "").trim())
      .map((f) => f.label[uiLanguage] ?? f.label.en ?? f.key);
  }

  async function startCall() {
    const missing = missingRequiredFacts();
    if (missing.length > 0 && !showMissingWarning) {
      setShowMissingWarning(true);
      return;
    }
    setShowMissingWarning(false);
    const callFacts = factsForPlaybook(
      playbook.facts.map((fact) => fact.key),
      facts
    );
    beginSession(playbook, callFacts);
  }

  async function startSos(id = "emergency-112") {
    if (sosBusy) return;
    setSosBusy(true);
    const target = getPlaybook(id) ?? emergencyPlaybooks()[0];
    if (!target) {
      setSosBusy(false);
      return;
    }
    const profile = loadProfile();
    const location = await readGpsLocation(profile.location?.trim() ?? "");
    const callFacts = factsForPlaybook(target.facts.map((fact) => fact.key), {
      ...loadFacts(),
      location,
    });
    beginSession(target, callFacts, { autoSpeakOpener: true, userBrief: "" });
  }

  if (!ready) {
    return <main className="min-h-screen bg-paper" />;
  }

  return (
    <AppChrome
      aside={
        <div className="flex items-center gap-5">
          <Link href="/history" className="text-sm font-semibold text-[var(--muted)] transition-colors hover:text-ink">
            {t("history.title")}
          </Link>
          <Link href="/setup" className="text-sm font-semibold text-[var(--muted)] transition-colors hover:text-ink">
            {t("start.edit_setup")}
          </Link>
        </div>
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

        <button
          type="button"
          onClick={() => void startSos()}
          disabled={sosBusy}
          className="mt-8 flex min-h-16 w-full items-center justify-between rounded-[1.5rem] bg-danger px-5 text-left text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          <span>
            <span className="block font-serif text-2xl">{t("start.sos")}</span>
            <span className="mt-1 block text-sm font-normal text-white/80">
              {t("start.sos_hint")}
            </span>
          </span>
          <span className="text-sm font-semibold">{sosBusy ? "…" : "112"}</span>
        </button>

        {!category ? (
          <>
            <p className="mt-10 eyebrow">{t("start.choose_category")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PLAYBOOK_CATEGORIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCategory(id);
                    const first = playbooksInCategory(id)[0];
                    if (first) selectPlaybook(first.id);
                  }}
                  className="choice h-full p-5 text-left"
                >
                  <span className="block font-serif text-2xl">{t(CATEGORY_KEY[id])}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mt-10 flex items-center justify-between">
              <p className="eyebrow">{t(CATEGORY_KEY[category])}</p>
              <button
                type="button"
                onClick={() => {
                  stopSpeak();
                  setCategory(null);
                }}
                className="text-sm font-semibold text-signal"
              >
                {t("start.back_to_categories")}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {listed.map((item) => (
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
          </>
        )}

        {category ? (
          <>
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
              <div className="mt-4 flex flex-col gap-3">
                {playbook.facts.map((fact) => {
                  const label = fact.label[uiLanguage] ?? fact.label.en ?? fact.key;
                  return (
                    <SpeakInput
                      key={fact.key}
                      label={label}
                      value={facts[fact.key] ?? ""}
                      onChange={(value) =>
                        setFacts((current) => ({ ...current, [fact.key]: value }))
                      }
                      placeholder={t("start.fact_empty")}
                      targetId={fact.key}
                      speakTarget={speakTarget}
                      speakUi={speak.ui}
                      onToggleSpeak={toggleSpeak}
                    />
                  );
                })}
              </div>
            </section>

            {playbook.emergency ? null : (
              <section className="mt-8 rounded-2xl border border-[var(--border)] bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-ink">{t("start.brief_title")}</h2>
                    <p className="mt-1 text-xs text-[var(--muted)]">{t("start.brief_hint")}</p>
                  </div>
                  <SpeakButton
                    listening={speakTarget === "brief" && speak.listening}
                    connecting={speakTarget === "brief" && speak.connecting}
                    onClick={() => toggleSpeak("brief")}
                  />
                </div>
                <textarea
                  value={spokenFieldValue(userBrief, speak.ui, speakTarget === "brief")}
                  onChange={(e) => setUserBrief(e.target.value)}
                  readOnly={
                    speakTarget === "brief" && (speak.listening || speak.connecting)
                  }
                  rows={3}
                  placeholder={t("start.brief_placeholder")}
                  className="field mt-3 w-full resize-none rounded-xl text-sm"
                />
                {speakTarget === "brief" && speak.listening ? (
                  <p className="mt-2 text-xs font-semibold text-signal">
                    {t("start.brief_listening")}
                  </p>
                ) : null}
                {speakTarget === "brief" && speak.error ? (
                  <p className="mt-2 text-xs font-semibold text-danger" role="status">
                    {speak.error}
                  </p>
                ) : null}
              </section>
            )}

            {showMissingWarning && !playbook.emergency && (
              <div className="mt-6 rounded-2xl border border-highlight/60 bg-highlight/10 px-5 py-4">
                <p className="text-sm font-semibold text-highlight-ink">
                  {t("start.missing_facts_warning", {
                    fields: missingRequiredFacts().join(", "),
                  })}
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void startCall()}
                    className="gold-btn min-h-12 px-6 text-base"
                  >
                    {t("start.call_button")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMissingWarning(false)}
                    className="ghost-btn min-h-12 px-6 text-base"
                  >
                    {t("history.back")}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-10 flex justify-end">
              <button type="button" onClick={() => void startCall()} className="gold-btn min-h-16 px-12 text-xl">
                {playbook.emergency ? t("start.sos") : t("start.call_button")}
              </button>
            </div>
          </>
        ) : null}
      </main>
    </AppChrome>
  );
}
