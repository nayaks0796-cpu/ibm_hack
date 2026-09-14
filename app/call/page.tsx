"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import CaptionFeed from "@/components/CaptionFeed";
import DTMFPad from "@/components/DTMFPad";
import ISLAvatar from "@/components/ISLAvatar";
import NumberCapturedBanner from "@/components/NumberCapturedBanner";
import RefusedOutcomeBanner from "@/components/RefusedOutcomeBanner";
import ReplySuggestions from "@/components/ReplySuggestions";
import SilenceRing, { type RingState } from "@/components/SilenceRing";
import SilentClerkBanner from "@/components/SilentClerkBanner";
import UnmuteButton from "@/components/UnmuteButton";
import { keytermsFromFacts } from "@/lib/elevenlabs/scribe";
import { containsSensitiveCode } from "@/lib/guard/otp";
import { redact } from "@/lib/guard/redact";
import { detectReferenceNumbers } from "@/lib/guard/refnum";
import { applyUiLanguage, t } from "@/lib/i18n";
import { decideCallOutcome } from "@/lib/outcome/decide";
import { detectRefusal } from "@/lib/outcome/refuse";
import { getPlaybook, playbookTitle } from "@/lib/playbooks";
import {
  appendTranscriptEntry,
  clearCallSession,
  loadCallSession,
  loadCurrentTranscript,
  loadProfile,
  saveCallSession,
  saveOutcome,
  saveProfile,
} from "@/lib/store";
import {
  alwaysPresentSuggestions,
  disclosureSuggestion,
  finalizeReplySuggestions,
} from "@/lib/suggestions/skeleton";
import { RoomTransport } from "@/lib/transport/RoomTransport";
import { createSTTWithFallback } from "@/lib/watson-stt/autoswitch";
import type { AccessNeed, ReplySuggestion, TranscriptEntry } from "@/lib/types";

const LINE_LABEL = {
  active: "call.line_active",
  silent: "call.line_silent",
  disconnected: "call.line_disconnected",
} as const;

const SILENT_CLERK_SEC = 10;

type SttController = ReturnType<typeof createSTTWithFallback>;

export default function CallPage() {
  const router = useRouter();
  const transportRef = useRef<RoomTransport | null>(null);
  const cancelSpeakRef = useRef<(() => void) | null>(null);
  const sttRef = useRef<SttController | null>(null);
  const unsubAudioRef = useRef<(() => void) | null>(null);
  const unmutedRef = useRef(false);
  const ingestRef = useRef<(text: string, fromVoice: boolean) => void>(
    () => undefined
  );
  const connectingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [lineState, setLineState] = useState<RingState>("disconnected");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [clerkDraft, setClerkDraft] = useState("");
  const [selected, setSelected] = useState<ReplySuggestion | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [heardRef, setHeardRef] = useState<string | null>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showIsl, setShowIsl] = useState(true);
  const [unmuted, setUnmuted] = useState(false);
  const [name, setName] = useState("");
  const [accessNeed, setAccessNeed] = useState<AccessNeed>("both");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [uiLanguage, setUiLanguage] = useState("en");
  const [callLanguage, setCallLanguage] = useState<"hi" | "en">("hi");
  const [playbookId, setPlaybookId] = useState("power-cut");
  const [playbookName, setPlaybookName] = useState("Power cut");
  const [playbookGoal, setPlaybookGoal] = useState("");
  const [llmSuggestions, setLlmSuggestions] = useState<ReplySuggestion[]>([]);
  const [gloss, setGloss] = useState<string[]>([]);
  const [demoVoice, setDemoVoice] = useState(true);
  const [liveCaptions, setLiveCaptions] = useState(false);
  const [backupCaptions, setBackupCaptions] = useState(false);
  const [micNeeded, setMicNeeded] = useState(false);
  const [livePartial, setLivePartial] = useState("");
  const [updatingReplies, setUpdatingReplies] = useState(false);
  const [clerkRefused, setClerkRefused] = useState(false);
  const [silentFor, setSilentFor] = useState(0);

  if (!transportRef.current) {
    transportRef.current = new RoomTransport();
  }

  async function bootLiveCaptions() {
    const transport = transportRef.current;
    if (!transport || connectingRef.current || sttRef.current) return;
    connectingRef.current = true;

    try {
      await transport.startInbound();
      setMicNeeded(false);
    } catch {
      setMicNeeded(true);
      connectingRef.current = false;
      return;
    }

    const tokenRes = await fetch("/api/scribe-token", { method: "POST" });
    let token: string | null = null;
    if (tokenRes.ok) {
      const data = (await tokenRes.json()) as { token?: string };
      token = data.token ?? null;
    }

    const profile = loadProfile();
    const session = loadCallSession();
    const lang = session?.callLanguage ?? profile.callLanguage;
    const controller = createSTTWithFallback(
      lang,
      (text, isFinal) => {
        if (!isFinal) {
          setLivePartial(text);
          return;
        }
        setLivePartial("");
        ingestRef.current(text, true);
      },
      () => setBackupCaptions(true),
      keytermsFromFacts(profile.name, session?.facts ?? {})
    );
    sttRef.current = controller;
    unsubAudioRef.current = transport.onInboundAudio((chunk) => {
      controller.sendAudio(chunk);
    });

    try {
      await controller.connect(token);
      setLiveCaptions(true);
    } catch {
      unsubAudioRef.current?.();
      unsubAudioRef.current = null;
      controller.disconnect();
      sttRef.current = null;
    } finally {
      connectingRef.current = false;
    }
  }

  useEffect(() => {
    const session = loadCallSession();
    const profile = loadProfile();
    if (!session || !profile.name.trim()) {
      router.replace("/start");
      return;
    }

    const playbook = getPlaybook(session.playbookId);
    setName(profile.name);
    setAccessNeed(profile.accessNeed);
    setFacts(session.facts ?? {});
    setShowIsl(session.islAvatar ?? profile.islAvatar);
    setUiLanguage(applyUiLanguage(profile.uiLanguage));
    setCallLanguage(session.callLanguage);
    setPlaybookId(session.playbookId);
    setPlaybookName(playbook ? playbookTitle(playbook, profile.uiLanguage) : session.playbookId);
    setPlaybookGoal(
      playbook?.goal[session.callLanguage] ?? playbook?.goal.en ?? ""
    );
    setEntries(loadCurrentTranscript());
    setSelected(
      disclosureSuggestion(profile.name, session.callLanguage, profile.accessNeed)
    );
    setReady(true);

    const transport = transportRef.current;
    if (!transport) return;

    const unsubscribe = transport.onLineState((state) => {
      setLineState(state);
      if (state !== "silent") setSilentFor(0);
    });
    void bootLiveCaptions();

    return () => {
      unsubscribe();
      unsubAudioRef.current?.();
      unsubAudioRef.current = null;
      sttRef.current?.disconnect();
      sttRef.current = null;
      transport.stopInbound();
    };
  }, [router]);

  useEffect(() => {
    if (lineState !== "silent") {
      setSilentFor(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setSilentFor(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [lineState]);

  const latestClerkCaption = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i].side === "clerk") return entries[i].text;
    }
    return "";
  }, [entries]);
  const contextual = useMemo(
    () =>
      finalizeReplySuggestions({
        facts,
        callLanguage,
        playbookId,
        caption: latestClerkCaption,
        name,
        accessNeed,
        llm: llmSuggestions,
      }),
    [
      name,
      accessNeed,
      facts,
      callLanguage,
      playbookId,
      uiLanguage,
      latestClerkCaption,
      llmSuggestions,
    ]
  );
  const alwaysPresent = useMemo(
    () => alwaysPresentSuggestions(callLanguage),
    [callLanguage, uiLanguage]
  );

  function pushEntry(entry: TranscriptEntry) {
    const text = redact(entry.text);
    const stored: TranscriptEntry = {
      ...entry,
      text,
      redacted: text !== entry.text,
    };
    appendTranscriptEntry(stored);
    setEntries((current) => [...current, stored]);
    return stored;
  }

  function ingestCaption(text: string, fromVoice: boolean) {
    const cleaned = text.trim();
    if (!cleaned) return;

    const asUser = fromVoice && unmutedRef.current;
    const stored = pushEntry({
      t: Date.now(),
      side: asUser ? "us" : "clerk",
      source: asUser ? "user-voice" : "stt",
      text: cleaned,
      redacted: false,
    });

    if (!asUser) {
      setSelected(null);
      setBlocked(false);
      setLlmSuggestions([]);
    }

    if (!asUser && detectRefusal(cleaned)) {
      setClerkRefused(true);
    }

    if (!asUser && !containsSensitiveCode(cleaned)) {
      const found = detectReferenceNumbers(cleaned);
      if (found[0]) setHeardRef(found[0]);
    }

    const history = loadCurrentTranscript();
    const session = loadCallSession();
    const lang = session?.callLanguage ?? callLanguage;
    const profile = loadProfile();
    setUpdatingReplies(true);
    void fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: stored.text,
        history: history.slice(-6),
        facts,
        goal: playbookGoal,
        callLanguage: lang,
        uiLanguage: profile.uiLanguage,
      }),
    })
      .then((res) => res.json())
      .then((data: { suggestions?: ReplySuggestion[] }) => {
        const next = (data.suggestions ?? []).filter(
          (item) =>
            item.sentence &&
            !item.id.startsWith("ap-") &&
            !item.id.startsWith("always-")
        );
        setLlmSuggestions(next);
      })
      .catch(() => {
        // Keep hardcoded reply suggestions if the LLM is offline.
      })
      .finally(() => setUpdatingReplies(false));

    if (asUser) return;

    void fetch("/api/gloss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: stored.text }),
    })
      .then((res) => res.json())
      .then((data: { gloss?: string[] }) => {
        if (data.gloss?.length) setGloss(data.gloss);
      })
      .catch(() => {
        // Keep the last gloss if the avatar endpoint is offline.
      });
  }

  ingestRef.current = (text, fromVoice) => ingestCaption(text, fromVoice);

  function addClerkCaption(event: FormEvent) {
    event.preventDefault();
    const text = clerkDraft.trim();
    if (!text) return;
    setClerkDraft("");
    ingestCaption(text, false);
  }

  async function handleSend() {
    if (!selected) return;

    if (containsSensitiveCode(selected.sentence)) {
      setBlocked(true);
      transportRef.current?.stopSpeaking();
      return;
    }

    setBlocked(false);

    pushEntry({
      t: Date.now(),
      side: "us",
      source: "tts-sent",
      text: selected.sentence,
      redacted: false,
    });

    const transport = transportRef.current;
    if (!transport) return;

    cancelSpeakRef.current = () => transport.stopSpeaking();

    try {
      const cancel = await transport.speak(
        selected.sentence,
        callLanguage,
        loadProfile().voice
      );
      cancelSpeakRef.current = cancel;
      setDemoVoice(transport.lastSpeakSource !== "eleven");
    } catch {
      transport.stopSpeaking();
      cancelSpeakRef.current = null;
    }
  }

  function handleUnmute() {
    transportRef.current?.stopSpeaking();
    cancelSpeakRef.current = null;
    setUnmuted((current) => {
      const next = !current;
      unmutedRef.current = next;
      return next;
    });
  }

  function handleDtmf(key: string) {
    transportRef.current?.sendDTMF(key);
    pushEntry({
      t: Date.now(),
      side: "us",
      source: "dtmf",
      text: key,
      redacted: false,
    });
  }

  function toggleIsl() {
    setShowIsl((value) => {
      const next = !value;
      const profile = loadProfile();
      saveProfile({ ...profile, islAvatar: next });
      const session = loadCallSession();
      if (session) {
        saveCallSession({ ...session, islAvatar: next });
      }
      return next;
    });
  }

  function pinHeard(ref?: string) {
    const session = loadCallSession();
    const value = ref ?? heardRef;
    if (!session || !value) return;
    saveCallSession({ ...session, pinnedReferenceNumber: value });
    setHeardRef(null);
  }

  function endCall(asRefused = false) {
    const session = loadCallSession();
    if (!session) {
      router.replace("/start");
      return;
    }

    unsubAudioRef.current?.();
    sttRef.current?.disconnect();
    transportRef.current?.stopInbound();
    const transcript = loadCurrentTranscript();
    const decided = decideCallOutcome({
      pinnedReferenceNumber: session.pinnedReferenceNumber,
      transcript,
      refused: asRefused || clerkRefused,
    });
    saveOutcome({
      playbookId: session.playbookId,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      result: decided.result,
      referenceNumber: decided.referenceNumber,
      facts: session.facts ?? {},
      transcript,
    });
    clearCallSession();
    router.push("/outcome");
  }

  if (!ready) {
    return <main className="min-h-screen bg-paper" />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
      <header className="flex items-center justify-between gap-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <SilenceRing state={lineState} />
          <div>
            <p className="text-sm font-semibold">{t(LINE_LABEL[lineState])}</p>
            <p className="text-xs text-[var(--muted)]">{playbookName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {backupCaptions ? (
            <span className="rounded-full bg-highlight/20 px-3 py-1 text-xs font-semibold text-highlight-ink">
              {t("call.backup_captions")}
            </span>
          ) : liveCaptions ? (
            <span className="rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal">
              {t("call.live_captions")}
            </span>
          ) : null}
          {demoVoice ? (
            <span className="rounded-full bg-highlight/20 px-3 py-1 text-xs font-semibold text-highlight-ink">
              {t("call.demo_voice")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={toggleIsl}
            aria-pressed={showIsl}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${
              showIsl
                ? "bg-ink text-paper"
                : "border border-[var(--border)] bg-raised text-ink"
            }`}
          >
            {showIsl ? t("call.isl_on") : t("call.isl_off")}
          </button>
          <button
            type="button"
            onClick={() => endCall()}
            className="min-h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          >
            {t("call.end")}
          </button>
        </div>
      </header>

      {micNeeded ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-raised px-4 py-3">
          <p className="text-sm text-[var(--muted)]">{t("call.mic_needed")}</p>
          <button
            type="button"
            onClick={() => void bootLiveCaptions()}
            className="ghost-btn min-h-11 px-4"
          >
            {t("call.allow_mic")}
          </button>
        </div>
      ) : null}

      {heardRef ? (
        <div className="mt-4">
          <NumberCapturedBanner
            referenceNumber={heardRef}
            onConfirmPin={pinHeard}
            onDismiss={() => setHeardRef(null)}
            lang={uiLanguage}
          />
        </div>
      ) : null}

      {clerkRefused ? (
        <div className="mt-4">
          <RefusedOutcomeBanner
            lang={uiLanguage}
            onEndCall={() => endCall(true)}
          />
        </div>
      ) : null}

      {lineState === "silent" && silentFor >= SILENT_CLERK_SEC && !clerkRefused ? (
        <div className="mt-4">
          <SilentClerkBanner
            isSilent
            silenceDurationSec={silentFor}
            lang={uiLanguage}
            onActionClick={(actionKey) => {
              const id =
                actionKey === "call.wait" ? "always-wait" : "always-repeat";
              const match = alwaysPresent.find((item) => item.id === id);
              if (match) {
                setSelected(match);
                setBlocked(false);
              }
            }}
          />
        </div>
      ) : null}

      <section
        className={`mt-4 grid min-h-0 flex-1 gap-4 ${
          showIsl ? "md:grid-cols-[1fr_220px]" : ""
        }`}
      >
        <CaptionFeed
          entries={entries}
          liveText={livePartial || (liveCaptions && !entries.length ? t("call.listening") : "")}
          liveSide={unmuted ? "us" : "clerk"}
        />
        {showIsl ? (
          <div className="flex flex-col gap-2">
            <ISLAvatar visible gloss={gloss} />
          </div>
        ) : null}
      </section>

      <form onSubmit={addClerkCaption} className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="clerk-line">
          {t("call.clerk_input_label")}
        </label>
        <input
          id="clerk-line"
          value={clerkDraft}
          onChange={(e) => setClerkDraft(e.target.value)}
          placeholder={t("call.clerk_input_placeholder")}
          className="field flex-1"
        />
        <button type="submit" className="ghost-btn min-h-14 px-5">
          {t("call.add_caption")}
        </button>
      </form>

      <div className="mt-4 rounded-[1.75rem] border border-[var(--border)] bg-raised p-4 shadow-card">
        {updatingReplies ? (
          <p className="mb-2 text-sm text-[var(--muted)]">
            {t("call.updating_suggestions")}
          </p>
        ) : null}
        <ReplySuggestions
          suggestions={contextual}
          alwaysPresent={alwaysPresent}
          selectedId={selected?.id ?? null}
          onSelect={(suggestion) => {
            setSelected(suggestion);
            setBlocked(false);
          }}
        />

        <div className="mt-4 rounded-2xl bg-paper p-4">
          {blocked ? (
            <p className="text-base font-semibold text-danger">
              {t("call.otp_blocked")}
            </p>
          ) : (
            <>
              <p className="eyebrow">{t("call.selected_hint")}</p>
              <p className="mt-2 font-serif text-2xl leading-snug">
                {selected?.sentence ?? t("call.pick_suggestion")}
              </p>
            </>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!selected}
            className="gold-btn min-h-16 flex-1 text-xl"
          >
            {t("call.send")}
          </button>
          <UnmuteButton unmuted={unmuted} onToggle={handleUnmute} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowKeypad((value) => !value)}
        className="mt-3 min-h-12 text-sm font-semibold text-signal"
      >
        {showKeypad ? t("call.hide_keypad") : t("call.keypad")}
      </button>
      {showKeypad ? (
        <div className="mt-2 pb-4">
          <DTMFPad onKey={handleDtmf} />
        </div>
      ) : null}
    </main>
  );
}
