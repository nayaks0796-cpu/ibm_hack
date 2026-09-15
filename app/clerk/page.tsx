"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CaptionFeed from "@/components/CaptionFeed";
import ReplySuggestions from "@/components/ReplySuggestions";
import SilenceRing, { type RingState } from "@/components/SilenceRing";
import UnmuteButton from "@/components/UnmuteButton";
import { applyUiLanguage, t, UI_LANGUAGES } from "@/lib/i18n";
import { getPlaybook, playbookTitle } from "@/lib/playbooks";
import { loadProfile } from "@/lib/store";
import { isEchoOfRecentTts, ttsHoldMs } from "@/lib/transport/echoGate";
import { CallRoom, type CallRoomMessage } from "@/lib/transport/CallRoom";
import { tryClaimSpeech } from "@/lib/transport/speechLock";
import { applyUtteranceVoice } from "@/lib/transport/speechVoice";
import type { ReplySuggestion, TranscriptEntry, UiLanguage } from "@/lib/types";

const LINE_LABEL = {
  active: "call.line_active",
  silent: "call.line_silent",
  disconnected: "call.line_disconnected",
  ringing: "call.line_ringing",
} as const;

const PRESETS: Record<
  string,
  Record<"hi" | "en", ReplySuggestion[]>
> = {
  "power-cut": {
    en: [
      {
        id: "s-greet",
        label: "Greet & ask problem",
        sentence:
          "Hello, welcome to the Electricity Support Center. How can I assist you today?",
      },
      {
        id: "s-ask-id",
        label: "Ask consumer number",
        sentence: "Please provide your Consumer Number.",
      },
      {
        id: "s-ask-area",
        label: "Ask area",
        sentence: "Which area or locality are you calling from?",
      },
      {
        id: "s-complaint",
        label: "Give complaint number",
        sentence:
          "Your complaint has been registered. Your complaint number is COMP-4821.",
      },
    ],
    hi: [
      {
        id: "s-greet",
        label: "स्वागत व समस्या पूछें",
        sentence:
          "नमस्ते, बिजली सहायता केंद्र में आपका स्वागत है। बताइए क्या समस्या है?",
      },
      {
        id: "s-ask-id",
        label: "उपभोक्ता संख्या पूछें",
        sentence: "कृपया अपना उपभोक्ता नंबर (Consumer Number) बताइए।",
      },
      {
        id: "s-ask-area",
        label: "इलाका पूछें",
        sentence: "आप किस इलाके या कॉलोनी से बोल रहे हैं?",
      },
      {
        id: "s-complaint",
        label: "शिकायत संख्या दें",
        sentence:
          "आपकी शिकायत दर्ज कर ली गई है। आपकी शिकायत संख्या COMP-4821 है।",
      },
    ],
  },
  bank: {
    en: [
      {
        id: "s-greet",
        label: "Cyber 1930 greeting",
        sentence:
          "Hello, Cyber Financial Fraud Helpline 1930. Has an unauthorized transaction occurred?",
      },
      {
        id: "s-ask-id",
        label: "Ask account digits",
        sentence: "Please provide the last four digits of your account or card.",
      },
      {
        id: "s-complaint",
        label: "Give reference number",
        sentence:
          "Your card has been blocked immediately. Your reference number is REF-8842.",
      },
    ],
    hi: [
      {
        id: "s-greet",
        label: "साइबर 1930 सहायता",
        sentence:
          "नमस्ते, साइबर वित्तीय धोखाधड़ी 1930 हेल्पलाइन। क्या अनाधिकृत लेन-देन हुआ है?",
      },
      {
        id: "s-ask-id",
        label: "खाता अंक पूछें",
        sentence: "कृपया अपने खाते या कार्ड के अंतिम चार अंक बताइए।",
      },
      {
        id: "s-complaint",
        label: "संदर्भ संख्या दें",
        sentence:
          "आपका कार्ड तुरंत ब्लॉक कर दिया गया है। आपका संदर्भ नंबर REF-8842 है।",
      },
    ],
  },
  hospital: {
    en: [
      {
        id: "s-greet",
        label: "OPD inquiry",
        sentence:
          "Hello, Hospital Information Center. What is the patient's name and required department?",
      },
      {
        id: "s-complaint",
        label: "Give token number",
        sentence:
          "Your OPD appointment has been confirmed. Your token number is HOSP-309.",
      },
    ],
    hi: [
      {
        id: "s-greet",
        label: "ओपीडी पूछताछ",
        sentence:
          "नमस्ते, अस्पताल पूछताछ केंद्र। मरीज का नाम और कौन सा विभाग चाहिए?",
      },
      {
        id: "s-complaint",
        label: "टोकन संख्या दें",
        sentence:
          "आपका ओपीडी स्लॉट बुक हो गया है। आपका टोकन नंबर HOSP-309 है।",
      },
    ],
  },
};

function testSuggestions(callLanguage: "hi" | "en"): ReplySuggestion[] {
  return callLanguage === "hi"
    ? [
        {
          id: "always-otp",
          label: "OTP पूछें",
          sentence:
            "सत्यापन के लिए आपके मोबाइल पर आया OTP 482911 बताइए।",
        },
        {
          id: "always-refuse",
          label: "मना करें",
          sentence: "हम इस मामले में कुछ नहीं कर सकते, ऑफिस आकर मिलिए।",
        },
      ]
    : [
        {
          id: "always-otp",
          label: "Ask OTP",
          sentence:
            "For verification, please provide the OTP 482911 sent to your mobile.",
        },
        {
          id: "always-refuse",
          label: "Refuse service",
          sentence:
            "We cannot assist with this over the phone, please visit our office in person.",
        },
      ];
}

export default function ClerkPage() {
  const roomRef = useRef<CallRoom | null>(null);
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
    lang: string;
    onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  } | null>(null);

  const [roomId] = useState("demo-room");
  const [callerName, setCallerName] = useState("Caller");
  const [playbookId, setPlaybookId] = useState("power-cut");
  const [playbookName, setPlaybookName] = useState("Power cut");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [callLanguage, setCallLanguage] = useState<"hi" | "en">("en");
  const [peerConnected, setPeerConnected] = useState(false);
  const [callActive, setCallActive] = useState(true);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [selected, setSelected] = useState<ReplySuggestion | null>(null);
  const [draftSentence, setDraftSentence] = useState("");
  const [originalSentence, setOriginalSentence] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [livePartial, setLivePartial] = useState("");
  const [micSupported, setMicSupported] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [showFacts, setShowFacts] = useState(true);

  const speakerEnabledRef = useRef(speakerEnabled);
  speakerEnabledRef.current = speakerEnabled;
  const callLanguageRef = useRef(callLanguage);
  callLanguageRef.current = callLanguage;
  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;
  const echoUntilRef = useRef(0);
  const lastUserTtsRef = useRef("");
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearEchoHoldTimer() {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function restartClerkMic() {
    if (!isListeningRef.current || Date.now() < echoUntilRef.current) return;
    try {
      recognitionRef.current?.start();
    } catch {
      // Already running.
    }
  }

  function holdClerkMicForTts(text: string) {
    const spoken = text.trim();
    if (!spoken) return;
    lastUserTtsRef.current = spoken;
    const holdMs = ttsHoldMs(spoken);
    echoUntilRef.current = Date.now() + holdMs;
    setLivePartial("");
    try {
      recognitionRef.current?.stop();
    } catch {
      // Mic may already be idle.
    }
    clearEchoHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      echoUntilRef.current = 0;
      restartClerkMic();
    }, holdMs);
  }

  useEffect(() => {
    const profile = loadProfile();
    if (profile.uiLanguage) {
      setUiLanguage(applyUiLanguage(profile.uiLanguage));
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("clerk-console-root");
    return () => {
      document.documentElement.classList.remove("clerk-console-root");
    };
  }, []);

  useEffect(() => {
    const room = new CallRoom(roomId, "clerk");
    roomRef.current = room;

    const unsubPeer = room.onPeerChange((connected) => {
      setPeerConnected(connected);
      if (connected) setCallActive(true);
    });

    const unsubscribe = room.onMessage((msg: CallRoomMessage) => {
      if (msg.type === "session-sync") {
        setCallerName(msg.callerName || "Caller");
        setPlaybookId(msg.playbookId || "power-cut");
        const playbook = getPlaybook(msg.playbookId || "power-cut");
        setPlaybookName(
          playbook ? playbookTitle(playbook) : msg.playbookId || "Call"
        );
        setFacts(msg.facts ?? {});
        const nextLang = msg.callLanguage === "hi" ? "hi" : "en";
        setCallLanguage(nextLang);
        callLanguageRef.current = nextLang;
        setCallActive(true);
      } else if (msg.type === "user-tts" || msg.type === "user-caption") {
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.side === "us" && last.text === msg.text) return prev;
          return [
            ...prev,
            {
              t: msg.timestamp || Date.now(),
              side: "us",
              source: msg.type === "user-tts" ? "tts-sent" : "user-voice",
              text: msg.text,
              redacted: false,
            },
          ];
        });

        holdClerkMicForTts(msg.text);

        // Same-laptop demo: /call already plays TTS. Do not re-speak here while
        // the clerk mic is live, or Web Speech will caption our own voice.
        if (
          speakerEnabledRef.current &&
          !isListeningRef.current &&
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          tryClaimSpeech(msg.msgId)
        ) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(msg.text);
            const speakLang =
              msg.type === "user-tts" && (msg.lang === "hi" || msg.lang === "en")
                ? msg.lang
                : callLanguageRef.current;
            applyUtteranceVoice(utterance, speakLang);
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
          } catch {
            // Browser speech is optional for the clerk desk.
          }
        }
      } else if (msg.type === "dtmf") {
        setEntries((prev) => [
          ...prev,
          {
            t: Date.now(),
            side: "us",
            source: "dtmf",
            text: msg.digit,
            redacted: false,
          },
        ]);
      } else if (msg.type === "call-ended") {
        setCallActive(false);
      }
    });

    return () => {
      unsubPeer();
      unsubscribe();
      clearEchoHoldTimer();
      room.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as unknown as {
        SpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          start: () => void;
          stop: () => void;
          onresult: ((event: {
            resultIndex: number;
            results: ArrayLike<{
              isFinal: boolean;
              0: { transcript: string };
            }>;
          }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
        };
        webkitSpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          start: () => void;
          stop: () => void;
          onresult: ((event: {
            resultIndex: number;
            results: ArrayLike<{
              isFinal: boolean;
              0: { transcript: string };
            }>;
          }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
        };
      }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => never })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = callLanguage === "hi" ? "hi-IN" : "en-IN";

      recognizer.onresult = (event) => {
        if (Date.now() < echoUntilRef.current) {
          setLivePartial("");
          return;
        }
        let finalTranscript = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interim += result[0].transcript;
        }
        const heard = finalTranscript.trim();
        if (heard && isEchoOfRecentTts(heard, lastUserTtsRef.current)) {
          setLivePartial("");
          return;
        }
        setLivePartial(interim);
        if (heard) {
          setLivePartial("");
          sendClerkText(finalTranscript, true);
        }
      };

      recognizer.onerror = () => {
        setIsListening(false);
        setLivePartial("");
      };

      recognizer.onend = () => {
        if (isListeningRef.current) {
          if (Date.now() < echoUntilRef.current) return;
          try {
            recognizer.start();
            return;
          } catch {
            // Fall through and mark the mic as off.
          }
        }
        setIsListening(false);
        setLivePartial("");
      };

      recognitionRef.current = recognizer;
      return () => {
        try {
          recognizer.onresult = null;
          recognizer.onerror = null;
          recognizer.onend = null;
          recognizer.stop();
        } catch {
          // Ignore teardown errors from the Web Speech API.
        }
        if (recognitionRef.current === recognizer) {
          recognitionRef.current = null;
        }
      };
    } catch {
      setMicSupported(false);
    }
  }, [callLanguage]);

  const contextual = useMemo(
    () =>
      PRESETS[playbookId]?.[callLanguage] ?? PRESETS["power-cut"][callLanguage],
    [playbookId, callLanguage]
  );
  const alwaysPresent = useMemo(
    () => testSuggestions(callLanguage),
    [callLanguage]
  );

  const displayEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        side: entry.side === "clerk" ? ("us" as const) : ("clerk" as const),
      })),
    [entries]
  );

  const lineState: RingState = !callActive
    ? "disconnected"
    : peerConnected
      ? "active"
      : "ringing";

  const playbook = getPlaybook(playbookId);

  function handleSwitchLanguage(
    newUiLang: UiLanguage,
    newCallLang?: "hi" | "en"
  ) {
    const targetCallLang: "hi" | "en" =
      newCallLang ?? (newUiLang === "hi" ? "hi" : "en");

    applyUiLanguage(newUiLang);
    setUiLanguage(newUiLang);
    setCallLanguage(targetCallLang);
    callLanguageRef.current = targetCallLang;

    const nextPlaybook = getPlaybook(playbookId);
    if (nextPlaybook) {
      setPlaybookName(playbookTitle(nextPlaybook, newUiLang));
    }

    roomRef.current?.send({
      type: "session-sync",
      callerName,
      playbookId,
      callLanguage: targetCallLang,
      facts,
    });
  }

  function sendClerkText(textToSend?: string, fromVoice = false) {
    const text = (textToSend || draftSentence).trim();
    if (!text) return;
    if (fromVoice && Date.now() < echoUntilRef.current) return;
    if (fromVoice && isEchoOfRecentTts(text, lastUserTtsRef.current)) return;

    setEntries((prev) => [
      ...prev,
      {
        t: Date.now(),
        side: "clerk",
        source: fromVoice ? "stt" : "tts-sent",
        text,
        redacted: false,
      },
    ]);

    if (fromVoice) {
      setLivePartial("");
    } else {
      setIsEditing(false);
    }

    roomRef.current?.send({
      type: "clerk-caption",
      text,
      isFinal: true,
      timestamp: Date.now(),
    });
  }

  function toggleSpeech() {
    if (!recognitionRef.current) {
      setMicSupported(false);
      return;
    }
    if (isListening) {
      isListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
      setLivePartial("");
      return;
    }
    try {
      // Stop clerk speaker so barge-in doesn't capture TTS as clerk speech.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      recognitionRef.current.lang = callLanguage === "hi" ? "hi-IN" : "en-IN";
      recognitionRef.current.start();
      isListeningRef.current = true;
      setIsListening(true);
    } catch {
      // Already started or brief browser glitch — keep mic available.
      setIsListening(false);
    }
  }

  function endCall() {
    setCallActive(false);
    roomRef.current?.send({
      type: "call-ended",
      timestamp: Date.now(),
    });
  }

  const consoleStatus = !callActive
    ? "Ended"
    : peerConnected
      ? "Live"
      : "Waiting";

  return (
    <main
      key={`${uiLanguage}-${callLanguage}`}
      className="clerk-console min-h-screen w-full pb-48"
    >
      <header className="clerk-console-banner">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <p className="eyebrow text-signal">Sampark desk</p>
            <h1 className="truncate font-serif text-3xl leading-none">
              Clerk Console
            </h1>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${
              peerConnected
                ? "border-signal bg-signal/15 text-signal"
                : callActive
                  ? "border-highlight bg-highlight/15 text-highlight"
                  : "border-[var(--border)] bg-raised text-[var(--muted)]"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {callActive ? (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${
                    peerConnected ? "bg-signal" : "bg-highlight"
                  }`}
                />
              ) : null}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  peerConnected
                    ? "bg-signal"
                    : callActive
                      ? "bg-highlight"
                      : "bg-danger"
                }`}
              />
            </span>
            {consoleStatus}
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <SilenceRing state={lineState} />
          <div>
            <p className="text-sm font-semibold">{t(LINE_LABEL[lineState])}</p>
            <p className="text-xs text-[var(--muted)]">
              {playbookName}
              {callerName ? ` · ${callerName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {peerConnected ? (
            <span className="rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal">
              {t("call.live_captions")}
            </span>
          ) : null}
          <button
            type="button"
            id="clerk-mic-toggle"
            onClick={toggleSpeech}
            disabled={!micSupported}
            aria-pressed={isListening}
            title={
              micSupported
                ? isListening
                  ? "Stop speaking — mic is live"
                  : "Speak with your mic — captions go to the caller"
                : "Mic speech is not supported in this browser. Type a reply and tap Send."
            }
            className={`min-h-11 rounded-full px-3.5 text-xs font-semibold transition-all ${
              !micSupported
                ? "cursor-not-allowed border border-[var(--border)] bg-raised text-[var(--muted)] opacity-60"
                : isListening
                  ? "bg-danger text-white shadow-sm border border-danger animate-pulse"
                  : "border border-signal bg-signal/15 text-signal hover:-translate-y-0.5"
            }`}
          >
            {isListening ? "Mic: LIVE" : "Mic: speak"}
          </button>
          <button
            type="button"
            onClick={() => setSpeakerEnabled((value) => !value)}
            aria-pressed={speakerEnabled}
            className={`min-h-11 rounded-full px-3.5 text-xs font-semibold transition-all ${
              speakerEnabled
                ? "bg-signal text-paper shadow-sm border border-signal"
                : "border border-[var(--border)] bg-raised text-[var(--muted)]"
            }`}
          >
            {speakerEnabled ? "Speaker: ON" : "Speaker: OFF"}
          </button>
          <button
            type="button"
            onClick={() => setShowFacts((value) => !value)}
            aria-pressed={showFacts}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${
              showFacts
                ? "bg-ink text-paper"
                : "border border-[var(--border)] bg-raised text-ink"
            }`}
          >
            {showFacts ? "Facts on" : "Facts off"}
          </button>
          {callActive ? (
            <button
              type="button"
              onClick={endCall}
              className="min-h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
            >
              {t("call.end")}
            </button>
          ) : (
            <span className="rounded-full bg-raised px-4 py-2 text-xs font-semibold text-[var(--muted)]">
              {t("call.line_disconnected")}
            </span>
          )}
        </div>
      </div>

      {!peerConnected && callActive ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] border-l-4 border-l-highlight bg-raised px-4 py-4">
          <p className="text-sm font-semibold">{t("call.waiting_caller")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("call.waiting_caller_hint")}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-card/90 backdrop-blur-sm px-4 py-2.5 shadow-sm animate-fade-up">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1 mr-1">
            <span>🌐</span>
            <span>{t("setup.ui_language") || "Language"}:</span>
          </span>
          {UI_LANGUAGES.map((lang) => {
            const isCurrent = uiLanguage === lang.id;
            return (
              <button
                key={lang.id}
                type="button"
                id={`clerk-switch-lang-${lang.id}`}
                onClick={() => handleSwitchLanguage(lang.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-[var(--signal)] text-white font-semibold shadow-sm scale-105"
                    : "bg-paper text-[var(--muted)] border border-[var(--border)] hover:text-ink hover:border-[var(--signal)]"
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1">
            <span>🗣️</span>
            <span>Voice:</span>
          </span>
          <div className="inline-flex rounded-full bg-paper p-0.5 border border-[var(--border)]">
            <button
              type="button"
              id="clerk-switch-voice-en"
              onClick={() => handleSwitchLanguage(uiLanguage, "en")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                callLanguage === "en"
                  ? "bg-ink text-paper shadow-sm"
                  : "text-[var(--muted)] hover:text-ink"
              }`}
            >
              English
            </button>
            <button
              type="button"
              id="clerk-switch-voice-hi"
              onClick={() => handleSwitchLanguage(uiLanguage, "hi")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                callLanguage === "hi"
                  ? "bg-ink text-paper shadow-sm"
                  : "text-[var(--muted)] hover:text-ink"
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>
      </div>

      <section
        className={`mt-4 grid min-h-0 flex-1 gap-4 ${
          showFacts ? "md:grid-cols-[1fr_380px] lg:grid-cols-[1fr_420px]" : ""
        }`}
      >
        <CaptionFeed
          entries={displayEntries}
          liveText={
            livePartial ||
            (isListening ? t("call.listening") : "")
          }
          liveSide="us"
          emptyText={
            peerConnected
              ? micSupported
                ? "Tap Mic: speak in the header, or pick a reply and Send."
                : "Pick a reply suggestion, edit if needed, then Send."
              : "Waiting for the caller…"
          }
          usLabel={t("call.you")}
          clerkLabel="Caller"
        />
        {showFacts ? (
          <div className="flex flex-col gap-2">
            <div className="flex min-h-[16rem] flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-raised">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="eyebrow">Caller facts</p>
                <p className="mt-1 font-serif text-2xl leading-snug">
                  {callerName}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{playbookName}</p>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                {playbook?.facts.length ? (
                  playbook.facts.map((fact) => (
                    <div key={fact.key}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        {fact.label[uiLanguage] ?? fact.label.en}
                      </p>
                      <p className="mt-1 font-serif text-lg">
                        {facts[fact.key]?.trim() || "—"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    Facts appear here when the caller starts the call.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                peerConnected ? "bg-emerald-400" : "bg-teal-400"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                peerConnected ? "bg-emerald-500" : "bg-teal-500"
              }`}
            />
          </span>
          <span className="font-semibold text-ink">
            {peerConnected
              ? "Caller Online & Synchronized"
              : "Waiting for caller…"}
          </span>
        </div>

        <Link
          href="/call"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--signal)] bg-signal/10 px-3 py-1.5 text-xs font-semibold text-[var(--signal)] hover:bg-signal/15 transition-colors"
        >
          Open Caller App ↗
        </Link>
      </div>

      <div className="mt-4 rounded-[1.75rem] border border-[var(--border)] bg-raised p-4 shadow-card">
        <ReplySuggestions
          suggestions={contextual}
          alwaysPresent={alwaysPresent}
          selectedId={selected?.id ?? null}
          onSelect={(suggestion) => {
            setSelected(suggestion);
            setDraftSentence(suggestion.sentence);
            setOriginalSentence(suggestion.sentence);
            setIsEditing(false);
          }}
        />
      </div>
      </div>

      {/* Sticky compose + speak bar — always in view so the clerk can talk */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-paper/95 px-4 py-3 shadow-[0_-18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
          {isListening ? (
            <p className="text-center text-xs font-semibold text-danger">
              Mic is live — speak now. Captions go to the caller automatically.
            </p>
          ) : null}
          {!micSupported ? (
            <p className="text-center text-xs font-medium text-[var(--muted)]">
              This browser cannot use the mic. Type below and tap Send.
            </p>
          ) : null}
          <div className="rounded-2xl border border-[var(--border)] bg-raised px-3 py-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-[var(--muted)]">
                {t("call.selected_hint")} (Editable)
              </span>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraftSentence(originalSentence || selected?.sentence || "");
                    setIsEditing(false);
                  }}
                  className="rounded-full border border-[var(--border)] bg-paper px-2.5 py-0.5 text-xs font-semibold text-ink"
                >
                  Reset draft
                </button>
              ) : (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 font-medium text-emerald-700">
                  Ready — Send or Mic
                </span>
              )}
            </div>
            <textarea
              id="clerk-speech-draft"
              value={draftSentence}
              onChange={(e) => {
                setDraftSentence(e.target.value);
                setIsEditing(true);
              }}
              rows={2}
              placeholder={
                micSupported
                  ? "Type here, or tap Mic: speak / Unmute"
                  : t("call.pick_suggestion")
              }
              className="field w-full font-serif text-lg leading-snug resize-none rounded-xl border-0 bg-transparent p-1 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              id="clerk-send-btn"
              onClick={() => sendClerkText()}
              disabled={!draftSentence.trim()}
              className="gold-btn min-h-14 flex-1 text-lg flex items-center justify-center gap-2"
            >
              <span>{t("call.send")}</span>
              <span className="text-sm opacity-70">↵ Speak</span>
            </button>
            <UnmuteButton
              unmuted={isListening}
              onToggle={toggleSpeech}
              disabled={!micSupported}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
