"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
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
    return <main className="min-h-screen bg-paper" />;
  }

  return (
    <AppChrome>
      <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 sm:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="animate-fade-up">
          <p className="eyebrow">{t("app.title")}</p>
          <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            {t("setup.heading")}
          </h1>
          <p className="mt-4 max-w-sm text-lg text-[var(--muted)]">{t("setup.intro")}</p>
        </div>

        <form
          onSubmit={handleSave}
          className="animate-fade-up space-y-8 [animation-delay:80ms]"
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("setup.name_label")}</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("setup.name_placeholder")}
              className="field"
            />
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">{t("setup.facts_heading")}</legend>
            {FACT_FIELDS.map((field) => (
              <label key={field.key} className="flex flex-col gap-2">
                <span className="text-sm text-[var(--muted)]">{t(field.label)}</span>
                <input
                  value={facts[field.key]}
                  onChange={(e) =>
                    setFacts((current) => ({ ...current, [field.key]: e.target.value }))
                  }
                  className="field"
                />
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("setup.ui_language")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {UI_LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setUiLanguage(lang.id)}
                  className={`choice ${uiLanguage === lang.id ? "choice-on" : ""}`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("setup.call_language")}</legend>
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
                  className={`choice min-h-16 ${callLanguage === lang.id ? "choice-on" : ""}`}
                >
                  {t(lang.label)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("setup.voice")}</span>
            <div className="choice choice-on min-h-16">{t("setup.voice.demo")}</div>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("setup.isl_avatar")}</legend>
            <div className="grid grid-cols-2 gap-2">
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
          </fieldset>

          <div className="flex justify-end pt-2">
            <button type="submit" className="gold-btn min-h-14 px-8 text-lg">
              {t("setup.save")}
            </button>
          </div>
        </form>
      </main>
    </AppChrome>
  );
}
