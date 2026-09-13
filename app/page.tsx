"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t, UI_LANGUAGES } from "@/lib/i18n";
import { loadFacts, loadProfile, saveFacts, saveProfile } from "@/lib/store";
import type { CallLanguage, UiLanguage, UserProfile } from "@/lib/types";

const FACT_FIELDS = [
  { key: "consumer_number", label: "setup.fact.consumer_number" },
  { key: "area", label: "setup.fact.area" },
  { key: "bank_name", label: "setup.fact.bank_name" },
  { key: "hospital_name", label: "setup.fact.hospital_name" },
] as const;

type FactKey = (typeof FACT_FIELDS)[number]["key"];

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [callLanguage, setCallLanguage] = useState<CallLanguage>("hi");
  const [islAvatar, setIslAvatar] = useState(true);
  const [facts, setFacts] = useState<Record<FactKey, string>>({
    consumer_number: "",
    area: "",
    bank_name: "",
    hospital_name: "",
  });

  useEffect(() => {
    const profile = loadProfile();
    const storedFacts = loadFacts();
    setName(profile.name);
    setUiLanguage(profile.uiLanguage);
    setCallLanguage(profile.callLanguage);
    setIslAvatar(profile.islAvatar);
    setFacts({
      consumer_number: storedFacts.consumer_number ?? "",
      area: storedFacts.area ?? "",
      bank_name: storedFacts.bank_name ?? "",
      hospital_name: storedFacts.hospital_name ?? "",
    });
    setReady(true);
  }, []);

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const profile: UserProfile = {
      name: name.trim(),
      uiLanguage,
      callLanguage,
      voice: "demo",
      islAvatar,
    };
    saveProfile(profile);
    saveFacts({
      ...loadFacts(),
      ...facts,
    });
    router.push("/start");
  }

  if (!ready) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--setu-forest)]">
        {t("app.title")}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{t("setup.title")}</h1>
      <p className="mt-2 text-base text-[var(--setu-muted)]">{t("setup.intro")}</p>

      <form onSubmit={handleSave} className="mt-8 flex flex-col gap-7">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t("setup.name_label")}</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("setup.name_placeholder")}
            className="min-h-14 rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] px-4 text-lg"
          />
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold">{t("setup.facts_heading")}</legend>
          {FACT_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-2">
              <span className="text-sm text-[var(--setu-muted)]">
                {t(field.label)}
              </span>
              <input
                value={facts[field.key]}
                onChange={(e) =>
                  setFacts((current) => ({ ...current, [field.key]: e.target.value }))
                }
                className="min-h-14 rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] px-4 text-lg"
              />
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("setup.ui_language")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {UI_LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setUiLanguage(lang.id)}
                className={`min-h-12 rounded-2xl border text-sm font-semibold ${
                  uiLanguage === lang.id
                    ? "border-[var(--setu-forest)] bg-[var(--setu-forest)] text-white"
                    : "border-[var(--setu-line)] bg-[var(--setu-card)]"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("setup.call_language")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "hi" as const, label: "setup.call_language.hi" as const },
                { id: "en" as const, label: "setup.call_language.en" as const },
              ]
            ).map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setCallLanguage(lang.id)}
                className={`min-h-14 rounded-2xl border text-base font-semibold ${
                  callLanguage === lang.id
                    ? "border-[var(--setu-forest)] bg-[var(--setu-forest)] text-white"
                    : "border-[var(--setu-line)] bg-[var(--setu-card)]"
                }`}
              >
                {t(lang.label)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t("setup.voice")}</span>
          <div className="min-h-14 rounded-2xl border border-[var(--setu-forest)] bg-[var(--setu-forest)] px-4 text-lg font-semibold leading-[3.5rem] text-white">
            {t("setup.voice.demo")}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("setup.isl_avatar")}</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIslAvatar(true)}
              className={`min-h-14 rounded-2xl border text-base font-semibold ${
                islAvatar
                  ? "border-[var(--setu-forest)] bg-[var(--setu-forest)] text-white"
                  : "border-[var(--setu-line)] bg-[var(--setu-card)]"
              }`}
            >
              {t("setup.isl_on")}
            </button>
            <button
              type="button"
              onClick={() => setIslAvatar(false)}
              className={`min-h-14 rounded-2xl border text-base font-semibold ${
                !islAvatar
                  ? "border-[var(--setu-forest)] bg-[var(--setu-forest)] text-white"
                  : "border-[var(--setu-line)] bg-[var(--setu-card)]"
              }`}
            >
              {t("setup.isl_off")}
            </button>
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-2 min-h-16 rounded-2xl bg-[var(--setu-ink)] text-lg font-bold text-[var(--setu-paper)]"
        >
          {t("setup.save")}
        </button>
      </form>
    </main>
  );
}
