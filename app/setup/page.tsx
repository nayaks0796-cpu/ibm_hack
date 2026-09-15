"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppChrome from "@/components/AppChrome";
import SpeakInput from "@/components/SpeakInput";
import { useSpeakToText } from "@/components/BriefMic";
import { previewVoice, type PreviewHandle } from "@/lib/elevenlabs/preview";
import { applyUiLanguage, t, UI_LANGUAGES, type MessageKey } from "@/lib/i18n";
import { loadProfile, saveProfile } from "@/lib/store";
import type { AccessNeed, CallLanguage, UiLanguage, UserProfile } from "@/lib/types";
import {
  defaultVoiceId,
  resolveVoiceId,
  voicesFor,
} from "@/lib/voices";

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
  const [callLanguage, setCallLanguage] = useState<CallLanguage>("en");
  const [voice, setVoice] = useState(defaultVoiceId("en"));
  const [accessNeed, setAccessNeed] = useState<AccessNeed>("both");
  const [location, setLocation] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const [speakTarget, setSpeakTarget] = useState<string | null>(null);
  const speakTargetRef = useRef<string | null>(null);
  const firstFinalRef = useRef(true);

  const speak = useSpeakToText({
    callLanguage,
    name,
    facts: { location },
    onTranscript: (text) => {
      const target = speakTargetRef.current;
      if (target === "name") {
        setName((current) => {
          if (firstFinalRef.current) {
            firstFinalRef.current = false;
            return text;
          }
          const prev = current.trim();
          return prev ? `${prev} ${text}` : text;
        });
        return;
      }
      if (target === "location") {
        setLocation((current) => {
          if (firstFinalRef.current) {
            firstFinalRef.current = false;
            return text;
          }
          const prev = current.trim();
          return prev ? `${prev} ${text}` : text;
        });
      }
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
    setName(profile.name);
    setUiLanguage(applyUiLanguage(profile.uiLanguage));
    setCallLanguage(profile.callLanguage);
    setVoice(resolveVoiceId(profile.voice, profile.callLanguage));
    setAccessNeed(profile.accessNeed);
    setLocation(profile.location ?? "");
    setReady(true);
  }, []);

  useEffect(() => {
    return () => {
      previewRef.current?.stop();
      previewRef.current = null;
    };
  }, []);

  function stopPreview() {
    previewRef.current?.stop();
    previewRef.current = null;
    setPreviewingId(null);
  }

  function selectCallLanguage(lang: CallLanguage) {
    stopPreview();
    setPreviewError(null);
    setCallLanguage(lang);
    setVoice((current) => resolveVoiceId(current, lang));
  }

  async function playSample(voiceId: string) {
    stopPreview();
    setPreviewError(null);
    setVoice(voiceId);
    setPreviewingId(voiceId);
    const handle = previewVoice(voiceId, callLanguage);
    previewRef.current = handle;
    try {
      await handle.done;
    } catch {
      // Selection still sticks; surface why Play failed (often TTS quota).
      setPreviewError(t("setup.preview_failed"));
    } finally {
      if (previewRef.current === handle) {
        previewRef.current = null;
        setPreviewingId(null);
      }
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    stopPreview();
    stopSpeak();
    const profile: UserProfile = {
      name: name.trim(),
      uiLanguage,
      callLanguage,
      voice: resolveVoiceId(voice, callLanguage),
      islAvatar: loadProfile().islAvatar,
      accessNeed,
      location: location.trim(),
    };
    saveProfile(profile);
    applyUiLanguage(uiLanguage);
    router.push("/start");
  }

  if (!ready) {
    return <main className="min-h-screen bg-paper" />;
  }

  const availableVoices = voicesFor(callLanguage);

  return (
    <AppChrome>
      <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 sm:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="animate-fade-up">
          <p className="eyebrow">{t("app.title")}</p>
          <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            {t("setup.heading")}
          </h1>
          <p className="mt-4 max-w-sm whitespace-pre-line text-lg text-[var(--muted)]">{t("setup.intro")}</p>
        </div>

        <form
          onSubmit={handleSave}
          className="animate-fade-up space-y-8 [animation-delay:80ms]"
        >
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">{t("setup.ui_language")}</legend>
            <p className="mb-3 text-sm text-[var(--muted)]">{t("setup.ui_language_hint")}</p>
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

          <SpeakInput
            label={t("setup.name_label")}
            hint={t("setup.name_hint")}
            value={name}
            onChange={setName}
            placeholder={t("setup.name_placeholder")}
            required
            autoComplete="name"
            targetId="name"
            speakTarget={speakTarget}
            speakUi={speak.ui}
            onToggleSpeak={toggleSpeak}
          />

          <SpeakInput
            label={t("setup.location_label")}
            hint={t("setup.location_hint")}
            value={location}
            onChange={setLocation}
            placeholder={t("setup.location_placeholder")}
            autoComplete="street-address"
            targetId="location"
            speakTarget={speakTarget}
            speakUi={speak.ui}
            onToggleSpeak={toggleSpeak}
          />

          <fieldset>
            <legend className="mb-1 text-sm font-semibold">{t("setup.access_need")}</legend>
            <p className="mb-3 text-sm text-[var(--muted)]">{t("setup.access_need_hint")}</p>
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
            <legend className="mb-1 text-sm font-semibold">{t("setup.call_language")}</legend>
            <p className="mb-3 text-sm text-[var(--muted)]">{t("setup.call_language_hint")}</p>
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
                  onClick={() => selectCallLanguage(lang.id)}
                  className={`choice min-h-16 ${callLanguage === lang.id ? "choice-on" : ""}`}
                >
                  {t(lang.label)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-semibold">{t("setup.voice")}</legend>
            <p className="mb-3 text-sm text-[var(--muted)]">{t("setup.voice_hint")}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {availableVoices.map((option) => {
                const selected = voice === option.id;
                const previewing = previewingId === option.id;
                return (
                  <div
                    key={option.id}
                    className={`choice flex min-h-16 items-center justify-between gap-2 ${selected ? "choice-on" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        stopPreview();
                        setPreviewError(null);
                        setVoice(option.id);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      {option.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => void playSample(option.id)}
                      aria-label={t("setup.play_sample")}
                      className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--teal)] transition hover:bg-[rgba(14,124,114,0.12)]"
                    >
                      {previewing ? "…" : t("setup.play_sample")}
                    </button>
                  </div>
                );
              })}
            </div>
            {previewError ? (
              <p className="mt-2 text-sm text-[var(--muted)]" role="status">
                {previewError}
              </p>
            ) : null}
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
