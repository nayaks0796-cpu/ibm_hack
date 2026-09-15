"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { applyUiLanguage, t, UI_LANGUAGES } from "@/lib/i18n";
import type { UiLanguage } from "@/lib/types";
import { CallRoom, type CallRoomMessage } from "@/lib/transport/CallRoom";
import { tryClaimSpeech } from "@/lib/transport/speechLock";

interface MessageItem {
  id: string;
  side: "clerk" | "us";
  text: string;
  time: string;
}

const PRESETS_HI = [
  {
    category: "Power Cut (बिजली विभाग)",
    items: [
      {
        label: "स्वागत व समस्या पूछें",
        text: "नमस्ते, बिजली सहायता केंद्र में आपका स्वागत है। बताइए क्या समस्या है?",
      },
      {
        label: "उपभोक्ता संख्या पूछें",
        text: "कृपया अपना उपभोक्ता नंबर (Consumer Number) बताइए।",
      },
      {
        label: "इलाका / कॉलोनी पूछें",
        text: "आप किस इलाके या कॉलोनी से बोल रहे हैं?",
      },
      {
        label: "शिकायत संख्या दें (COMP-4821)",
        text: "आपकी शिकायत दर्ज कर ली गई है। आपकी शिकायत संख्या COMP-4821 है।",
      },
    ],
  },
  {
    category: "Bank / Cyber 1930 (बैंक / साइबर)",
    items: [
      {
        label: "साइबर 1930 सहायता",
        text: "नमस्ते, साइबर वित्तीय धोखाधड़ी 1930 हेल्पलाइन। क्या अनाधिकृत लेन-देन हुआ है?",
      },
      {
        label: "खाता / कार्ड विवरण पूछें",
        text: "कृपया अपने खाते या कार्ड के अंतिम चार अंक बताइए।",
      },
      {
        label: "कार्ड ब्लॉक पुष्टि (REF-8842)",
        text: "आपका कार्ड तुरंत ब्लॉक कर दिया गया है। आपका संदर्भ नंबर REF-8842 है।",
      },
    ],
  },
  {
    category: "Hospital (अस्पताल अपॉइंटमेंट)",
    items: [
      {
        label: "ओपीडी पूछताछ",
        text: "नमस्ते, अस्पताल पूछताछ केंद्र। मरीज का नाम और कौन सा विभाग चाहिए?",
      },
      {
        label: "टोकन संख्या दें (HOSP-309)",
        text: "आपका ओपीडी स्लॉट बुक हो गया है। आपका टोकन नंबर HOSP-309 है।",
      },
    ],
  },
  {
    category: "Safety & Refusal Tests (सुरक्षा परीक्षण)",
    items: [
      {
        label: "OTP पूछें (सुरक्षा गार्ड टेस्ट)",
        text: "सत्यापन के लिए आपके मोबाइल पर आया OTP 482911 बताइए।",
      },
      {
        label: "मना करें (Refusal टेस्ट)",
        text: "हम इस मामले में कुछ नहीं कर सकते, ऑफिस आकर मिलिए।",
      },
    ],
  },
];

const PRESETS_EN = [
  {
    category: "Power Cut (Electricity Department)",
    items: [
      {
        label: "Greet & ask problem",
        text: "Hello, welcome to the Electricity Support Center. How can I assist you today?",
      },
      {
        label: "Ask Consumer Number",
        text: "Please provide your Consumer Number.",
      },
      {
        label: "Ask Area / Locality",
        text: "Which area or locality are you calling from?",
      },
      {
        label: "Provide Complaint Number (COMP-4821)",
        text: "Your complaint has been registered. Your complaint number is COMP-4821.",
      },
    ],
  },
  {
    category: "Bank / Cyber 1930 Helpline",
    items: [
      {
        label: "Cyber 1930 greeting",
        text: "Hello, Cyber Financial Fraud Helpline 1930. Has an unauthorized transaction occurred?",
      },
      {
        label: "Ask account / card digits",
        text: "Please provide the last four digits of your account or card.",
      },
      {
        label: "Card blocked confirmation (REF-8842)",
        text: "Your card has been blocked immediately. Your reference number is REF-8842.",
      },
    ],
  },
  {
    category: "Hospital Appointment",
    items: [
      {
        label: "OPD inquiry",
        text: "Hello, Hospital Information Center. What is the patient's name and required department?",
      },
      {
        label: "Provide token number (HOSP-309)",
        text: "Your OPD appointment has been confirmed. Your token number is HOSP-309.",
      },
    ],
  },
  {
    category: "Safety & Refusal Tests",
    items: [
      {
        label: "Ask OTP (Security Guard Test)",
        text: "For verification, please provide the OTP 482911 sent to your mobile.",
      },
      {
        label: "Refuse service (Refusal Test)",
        text: "We cannot assist with this over the phone, please visit our office in person.",
      },
    ],
  },
];

export default function ClerkPage() {
  const roomRef = useRef<CallRoom | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  const [roomId, setRoomId] = useState("demo-room");
  const [callerName, setCallerName] = useState("Satya");
  const [playbookName, setPlaybookName] = useState("Power cut");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [callLanguage, setCallLanguage] = useState<"hi" | "en">("en");
  const [connected, setConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [callActive, setCallActive] = useState(true);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "init-1",
      side: "clerk",
      text: "Operator station online. Waiting for caller...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    },
  ]);

  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);

  const speakerEnabledRef = useRef(speakerEnabled);
  speakerEnabledRef.current = speakerEnabled;

  const callLanguageRef = useRef(callLanguage);
  callLanguageRef.current = callLanguage;

  // Initialize CallRoom connection with stable dependencies
  useEffect(() => {
    const room = new CallRoom(roomId, "clerk");
    roomRef.current = room;

    const unsubscribe = room.onMessage((msg: CallRoomMessage) => {
      if (msg.type === "room-joined" || msg.type === "peer-joined") {
        setConnected(true);
        if (msg.clientCount) setPeerCount(msg.clientCount);
      } else if (msg.type === "peer-left") {
        if (msg.clientCount) setPeerCount(msg.clientCount);
      } else if (msg.type === "session-sync") {
        setCallerName(msg.callerName || "Caller");
        setPlaybookName(
          msg.playbookId === "power-cut"
            ? "Power cut"
            : msg.playbookId === "bank"
            ? "Bank / Cyber 1930"
            : "Hospital"
        );
        const nextLang = msg.callLanguage === "en" ? "en" : "hi";
        setCallLanguage(nextLang);
        callLanguageRef.current = nextLang;
        setCallActive(true);
      } else if (msg.type === "user-tts" || msg.type === "user-caption") {
        const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        // Deduplicate visual message addition
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.side === "us" && last.text === msg.text) {
            return prev;
          }
          return [
            ...prev,
            {
              id: msg.msgId || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              side: "us",
              text: msg.text,
              time,
            },
          ];
        });

        // Speak incoming message ONLY if this tab claims the single-speech lock
        if (
          speakerEnabledRef.current &&
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          tryClaimSpeech(msg.msgId)
        ) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(msg.text);
            utterance.lang = callLanguageRef.current === "hi" ? "hi-IN" : "en-IN";
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
          } catch {}
        }
      } else if (msg.type === "dtmf") {
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setMessages((prev) => [
          ...prev,
          {
            id: `dtmf-${Date.now()}`,
            side: "us",
            text: `[DTMF TONE PRESSED: ${msg.digit}]`,
            time,
          },
        ]);
      } else if (msg.type === "call-ended") {
        setCallActive(false);
      }
    });

    return () => {
      unsubscribe();
      room.disconnect();
    };
  }, [roomId]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set up Speech Recognition (Web Speech API)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.lang = callLanguage === "hi" ? "hi-IN" : "en-IN";

      recognizer.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            setDraft(event.results[i][0].transcript);
          }
        }
        if (finalTranscript) {
          setDraft(finalTranscript);
          sendClerkText(finalTranscript);
          setIsListening(false);
        }
      };

      recognizer.onerror = () => {
        setIsListening(false);
      };

      recognizer.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognizer;
    } catch {
      setMicSupported(false);
    }
  }, [callLanguage]);

  function toggleSpeech() {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setDraft("");
      try {
        recognitionRef.current.lang = callLanguage === "hi" ? "hi-IN" : "en-IN";
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  }

  function handleSwitchLanguage(newUiLang: UiLanguage, newCallLang?: "hi" | "en") {
    const targetCallLang: "hi" | "en" =
      newCallLang ?? (newUiLang === "hi" ? "hi" : "en");

    applyUiLanguage(newUiLang);
    setUiLanguage(newUiLang);
    setCallLanguage(targetCallLang);
    callLanguageRef.current = targetCallLang;

    roomRef.current?.send({
      type: "session-sync",
      callerName,
      playbookId: playbookName.toLowerCase().includes("power")
        ? "power-cut"
        : playbookName.toLowerCase().includes("bank")
        ? "bank"
        : "hospital",
      callLanguage: targetCallLang,
      facts: {},
    });
  }

  function repeatPreviousStatement() {
    let lastClerkStatement = "";
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].side === "clerk" && messages[i].id !== "init-1") {
        lastClerkStatement = messages[i].text;
        break;
      }
    }

    const textToRepeat =
      lastClerkStatement.trim() ||
      (callLanguage === "hi"
        ? "नमस्ते, कृपया बताइए क्या समस्या है?"
        : "Hello, please tell me how I can assist you today.");

    sendClerkText(textToRepeat);
  }

  function sendClerkText(textToSend?: string) {
    const text = (textToSend || draft).trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `clerk-${Date.now()}`,
        side: "clerk",
        text,
        time,
      },
    ]);

    setDraft("");

    // Send through CallRoom to the User (/call)
    roomRef.current?.send({
      type: "clerk-caption",
      text,
      isFinal: true,
      timestamp: Date.now(),
    });
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    sendClerkText();
  }

  function endCall() {
    setCallActive(false);
    roomRef.current?.send({
      type: "call-ended",
      timestamp: Date.now(),
    });
  }

  const activePresets = callLanguage === "hi" ? PRESETS_HI : PRESETS_EN;

  return (
    <div className="flex min-h-screen flex-col bg-[#0d1217] text-slate-100 font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-[#121922] px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Sampark Clerk Console
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  Live Operator
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Official Desk Operator View • Room: <span className="font-mono text-emerald-300">{roomId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSpeakerEnabled(!speakerEnabled)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                speakerEnabled
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              }`}
            >
              <span>{speakerEnabled ? "🔊 Operator Speaker ON" : "🔈 Operator Speaker Muted"}</span>
            </button>

            <Link
              href="/call"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 px-3.5 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20"
            >
              <span>Open Caller App ↗</span>
            </Link>

            {callActive ? (
              <button
                type="button"
                onClick={endCall}
                className="rounded-full bg-red-600/20 border border-red-500/30 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-600/30 transition-colors"
              >
                Disconnect Call
              </button>
            ) : (
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                Call Ended
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Dynamic In-Call Language Switcher Bar — Same as User (/call) */}
      <div className="border-b border-slate-800/80 bg-[#0e141c] px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Quick UI Language Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
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
                      ? "bg-teal-500 text-black font-bold shadow-sm scale-105"
                      : "bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:border-teal-400"
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>

          {/* Spoken Voice Language Accent Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <span>🗣️</span>
              <span>Voice:</span>
            </span>
            <div className="inline-flex rounded-full bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                id="clerk-switch-voice-en"
                onClick={() => handleSwitchLanguage(uiLanguage, "en")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                  callLanguage === "en"
                    ? "bg-teal-500 text-black shadow-sm"
                    : "text-slate-300 hover:text-white"
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
                    ? "bg-teal-500 text-black shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Left Column: Live Call Monitor & Transcript */}
        <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#121922] p-5 shadow-lg">
          {/* Active Call Information Bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-[#0d1217] p-3.5 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <div>
                <span className="text-slate-400">Caller:</span>{" "}
                <strong className="text-white font-semibold">{callerName}</strong>
              </div>
            </div>

            <div>
              <span className="text-slate-400">Playbook:</span>{" "}
              <strong className="text-amber-300 font-semibold">{playbookName}</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Spoken:</span>
              <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-teal-300">
                {callLanguage === "hi" ? "हिन्दी (HI)" : "English (EN)"}
              </span>
            </div>

            <div className="text-slate-400">
              Peers: <strong className="text-white">{peerCount}</strong>
            </div>
          </div>

          {/* Transcript Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 rounded-xl bg-[#080c10] p-4 max-h-[460px] min-h-[360px] border border-slate-800/80">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.side === "clerk" ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400 mb-1">
                  <span>{msg.side === "clerk" ? "You (Operator)" : "Caller (Assistive Relay)"}</span>
                  <span>•</span>
                  <span>{msg.time}</span>
                  {msg.side === "clerk" && (
                    <button
                      type="button"
                      onClick={() => sendClerkText(msg.text)}
                      className="ml-1 text-slate-500 hover:text-amber-300 text-[10px] font-medium"
                      title="Repeat this message to caller"
                    >
                      🔁 Repeat
                    </button>
                  )}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    msg.side === "clerk"
                      ? "bg-teal-700 text-white rounded-tr-none font-medium"
                      : "bg-[#1d2633] text-slate-100 border border-slate-700/60 rounded-tl-none font-medium"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={transcriptBottomRef} />
          </div>

          {/* Clerk Input Station */}
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
            <form onSubmit={handleFormSubmit} className="flex gap-2">
              {micSupported && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all ${
                    isListening
                      ? "border-red-500 bg-red-600 text-white shadow-lg animate-pulse"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-700"
                  }`}
                  title={isListening ? "Listening... click to stop" : "Speak to caller"}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
              )}

              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={isListening ? "Listening to your voice..." : "Type operator message or state query..."}
                className="flex-1 rounded-xl border border-slate-700 bg-[#080c10] px-4 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />

              <button
                type="button"
                id="clerk-repeat-prev-btn"
                onClick={repeatPreviousStatement}
                className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-3.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-all flex items-center gap-1.5"
                title="Repeat previous operator statement to caller"
              >
                <span>🔁</span>
                <span className="hidden sm:inline">Repeat</span>
              </button>

              <button
                type="submit"
                className="rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-md hover:bg-teal-500 active:scale-95 transition-all"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Canned Prompts & Fast Demo Controls */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#121922] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-teal-400">
                Quick Operator Prompts
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                One-click templates ({callLanguage === "hi" ? "हिन्दी" : "English"})
              </p>
            </div>

            <button
              type="button"
              onClick={repeatPreviousStatement}
              className="rounded-lg bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 flex items-center gap-1"
            >
              <span>🔁 Repeat Last</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[560px]">
            {activePresets.map((group) => (
              <div key={group.category} className="rounded-xl border border-slate-800/80 bg-[#080c10] p-3.5">
                <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>{group.category}</span>
                </h3>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => sendClerkText(item.text)}
                      className="group flex w-full flex-col rounded-lg border border-slate-800 bg-[#101720] p-2.5 text-left transition-colors hover:border-teal-500/50 hover:bg-[#15202c]"
                    >
                      <span className="text-xs font-medium text-teal-300 group-hover:text-teal-200">
                        {item.label}
                      </span>
                      <span className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">
                        &ldquo;{item.text}&rdquo;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
