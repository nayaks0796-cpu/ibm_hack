"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
import { applyUiLanguage, t, UI_LANGUAGES, type MessageKey } from "@/lib/i18n";
import { loadProfile, saveProfile } from "@/lib/store";
import type { AccessNeed, CallLanguage, UiLanguage, UserProfile } from "@/lib/types";
import { VOICES, defaultVoiceId, resolveVoiceId } from "@/lib/voices";

const ACCESS_NEEDS: { id: AccessNeed; label: MessageKey }[] = [
  { id: "hearing", label: "setup.access_hearing" },
  { id: "speech", label: "setup.access_speech" },
  { id: "both", label: "setup.access_both" },
];

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [callLanguage, setCallLanguage] = useState<CallLanguage>("hi");
  const [voice, setVoice] = useState(defaultVoiceId("hi"));
  const [accessNeed, setAccessNeed] = useState<AccessNeed>("both");

  useEffect(() => {
    const profile = loadProfile();
    setName(profile.name);
    setUiLanguage(applyUiLanguage(profile.uiLanguage));
    setCallLanguage(profile.callLanguage);
    setVoice(resolveVoiceId(profile.voice, profile.callLanguage));
    setAccessNeed(profile.accessNeed);
    setReady(true);
  }, []);

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const profile: UserProfile = {
      name: name.trim(),
      uiLanguage,
      callLanguage,
      voice: resolveVoiceId(voice, callLanguage),
      islAvatar: loadProfile().islAvatar,
      accessNeed,
    };
    saveProfile(profile);
    applyUiLanguage(uiLanguage);
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
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("setup.ui_language")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {UI_LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => {
                    applyUiLanguage(lang.id);
                    setUiLanguage(lang.id);
                  }}
                  className={`choice ${uiLanguage === lang.id ? "choice-on" : ""}`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </fieldset>

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

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("setup.access_need")}</legend>
            <div className="grid gap-2">
              {ACCESS_NEEDS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccessNeed(option.id)}
                  className={`choice min-h-14 text-left ${accessNeed === option.id ? "choice-on" : ""}`}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("setup.call_language")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "hi" as const, label: "setup.call_language_hi" as const },
                  { id: "en" as const, label: "setup.call_language_en" as const },
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

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("setup.voice")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {VOICES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setVoice(option.id)}
                  className={`choice min-h-16 ${voice === option.id ? "choice-on" : ""}`}
                >
                  {option.name}
                </button>
              ))}
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
