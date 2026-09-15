"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CallRoom, type CallRoomMessage } from "@/lib/transport/CallRoom";
import CaptionFeed from "@/components/CaptionFeed";
import DTMFPad from "@/components/DTMFPad";
import ISLAvatar from "@/components/ISLAvatar";
import NumberCapturedBanner from "@/components/NumberCapturedBanner";
import RefusedOutcomeBanner from "@/components/RefusedOutcomeBanner";
import ReplySuggestions from "@/components/ReplySuggestions";
import SilenceRing, { type RingState } from "@/components/SilenceRing";
import SilentClerkBanner from "@/components/SilentClerkBanner";
import { keytermsFromFacts } from "@/lib/elevenlabs/scribe";
import { containsSensitiveCode } from "@/lib/guard/otp";
import { redact } from "@/lib/guard/redact";
import { detectReferenceNumbers } from "@/lib/guard/refnum";
import { applyUiLanguage, t, UI_LANGUAGES } from "@/lib/i18n";
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
  accessNeedPhrase,
  alwaysPresentSuggestions,
  detectClerkIntent,
  disclosureSuggestion,
  finalizeReplySuggestions,
} from "@/lib/suggestions/skeleton";
import { RoomTransport } from "@/lib/transport/RoomTransport";
import { tryClaimSpeech } from "@/lib/transport/speechLock";
import { createSTTWithFallback } from "@/lib/watson-stt/autoswitch";
import type {
  AccessNeed,
  ReplySuggestion,
  TranscriptEntry,
  UiLanguage,
} from "@/lib/types";

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
  const ingestRef = useRef<(text: string, fromVoice: boolean) => void>(
    () => undefined
  );
  const connectingRef = useRef(false);
  const roomRef = useRef<CallRoom | null>(null);

  const [ready, setReady] = useState(false);
  const [clerkPeerConnected, setClerkPeerConnected] = useState(false);
  const [lineState, setLineState] = useState<RingState>("disconnected");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [clerkDraft, setClerkDraft] = useState("");
  const [selected, setSelected] = useState<ReplySuggestion | null>(null);
  const [draftSentence, setDraftSentence] = useState("");
  const [originalSentence, setOriginalSentence] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  const [autoPilot, setAutoPilot] = useState(true);
  const autoPilotRef = useRef(true);
  autoPilotRef.current = autoPilot;

  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [needsIntervention, setNeedsIntervention] = useState(false);
  const [interventionReason, setInterventionReason] = useState("");
  const [userBrief, setUserBrief] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [heardRef, setHeardRef] = useState<string | null>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showIsl, setShowIsl] = useState(true);
  const [name, setName] = useState("");
  const [accessNeed, setAccessNeed] = useState<AccessNeed>("both");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [callLanguage, setCallLanguage] = useState<"hi" | "en">("en");
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

    const brief = session.userBrief?.trim();
    setUserBrief(brief || "");

    let initialSug: ReplySuggestion;
    if (brief) {
      const initialSentence =
        session.callLanguage === "hi"
          ? `नमस्ते, मैं ${profile.name} बोल रहा हूँ। ${accessNeedPhrase(profile.accessNeed, "hi")}। ${brief}`
          : `Hello, my name is ${profile.name}. ${accessNeedPhrase(profile.accessNeed, "en")}. ${brief}`;
      initialSug = {
        id: "brief-intro",
        label: t("call.suggest.state_issue") || "Initial Statement",
        sentence: initialSentence,
      };
    } else {
      initialSug = disclosureSuggestion(profile.name, session.callLanguage, profile.accessNeed);
    }

    setSelected(initialSug);
    setDraftSentence(initialSug.sentence);
    setOriginalSentence(initialSug.sentence);
    setReady(true);

    const transport = transportRef.current;
    if (!transport) return;

    const unsubscribe = transport.onLineState((state) => {
      setLineState(state);
      if (state !== "silent") setSilentFor(0);
    });
    void bootLiveCaptions();

    const room = new CallRoom("demo-room", "user");
    roomRef.current = room;

    room.send({
      type: "session-sync",
      callerName: profile.name,
      playbookId: session.playbookId,
      callLanguage: session.callLanguage,
      facts: session.facts ?? {},
    });

    const unsubRoom = room.onMessage((msg: CallRoomMessage) => {
      if (msg.type === "clerk-caption") {
        if (msg.text) {
          ingestRef.current(msg.text, false);
        }
      } else if (msg.type === "peer-joined" || msg.type === "room-joined") {
        setClerkPeerConnected(true);
        room.send({
          type: "session-sync",
          callerName: profile.name,
          playbookId: session.playbookId,
          callLanguage: session.callLanguage,
          facts: session.facts ?? {},
        });
      } else if (msg.type === "session-sync") {
        if (msg.callLanguage && (msg.callLanguage === "en" || msg.callLanguage === "hi")) {
          setCallLanguage(msg.callLanguage);
        }
      } else if (msg.type === "peer-left") {
        setClerkPeerConnected(false);
      } else if (msg.type === "call-ended") {
        endCall();
      }
    });

    return () => {
      unsubRoom();
      room.disconnect();
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

    const asUser = false;
    const stored = pushEntry({
      t: Date.now(),
      side: asUser ? "us" : "clerk",
      source: asUser ? "user-voice" : "stt",
      text: cleaned,
      redacted: false,
    });

    if (!asUser) {
      if (!isEditingRef.current) {
        setSelected(null);
        setBlocked(false);
        setLlmSuggestions([]);

        // Detect if clerk asked for missing fact
        const intent = detectClerkIntent(cleaned);
        if (intent === "ask-id" && !facts.consumer_number && !facts.meter_number && !facts.account_number) {
          setNeedsIntervention(true);
          setInterventionReason(
            callLanguage === "hi"
              ? "ऑपरेटर ने उपभोक्ता / मीटर संख्या पूछी है जो उपलब्ध नहीं है। कृपया नीचे लिखें या चुनें।"
              : "Operator asked for your Consumer / Meter Number. Please provide or select below."
          );
          if (autoTimerRef.current) {
            clearInterval(autoTimerRef.current);
            autoTimerRef.current = null;
          }
          setAutoCountdown(null);
        } else if (intent === "ask-place" && !facts.area) {
          setNeedsIntervention(true);
          setInterventionReason(
            callLanguage === "hi"
              ? "ऑपरेटर ने आपका इलाका / क्षेत्र पूछा है। कृपया नीचे लिखें या चुनें।"
              : "Operator asked for your locality / area. Please provide or select below."
          );
          if (autoTimerRef.current) {
            clearInterval(autoTimerRef.current);
            autoTimerRef.current = null;
          }
          setAutoCountdown(null);
        } else {
          setNeedsIntervention(false);
          setInterventionReason("");
        }
      }
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
        if (!isEditingRef.current && next[0]) {
          setSelected(next[0]);
          setDraftSentence(next[0].sentence);
          setOriginalSentence(next[0].sentence);
          if (autoPilotRef.current && !needsIntervention) {
            triggerAutoSpeak(next[0].sentence, 2.5);
          }
        }
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

  function triggerAutoSpeak(sentence: string, delaySec = 2.5) {
    if (!autoPilotRef.current || isEditingRef.current || needsIntervention) return;
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);

    setAutoCountdown(delaySec);
    const started = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      const remaining = Math.max(0, +(delaySec - elapsed).toFixed(1));
      setAutoCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        autoTimerRef.current = null;
        setAutoCountdown(null);
        if (autoPilotRef.current && !isEditingRef.current) {
          void handleSend(sentence);
        }
      }
    }, 100);
    autoTimerRef.current = interval;
  }

  function handleReframe(type: "urgent" | "polite" | "concise") {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoCountdown(null);
    setIsEditing(true);
    isEditingRef.current = true;

    const base = (draftSentence || selected?.sentence || "").trim();
    if (!base) return;

    if (type === "urgent") {
      if (callLanguage === "hi") {
        setDraftSentence(`यह अत्यंत आवश्यक और आपातकालीन मामला है, कृपया तुरंत संज्ञान लें: ${base}`);
      } else {
        setDraftSentence(`This is extremely urgent, please prioritize this immediately: ${base}`);
      }
    } else if (type === "polite") {
      if (callLanguage === "hi") {
        setDraftSentence(`नमस्ते, आपसे विनम्र अनुरोध है कि इसमें मेरी सहायता करें: ${base} धन्यवाद।`);
      } else {
        setDraftSentence(`Hello, kindly request your assistance with this matter: ${base} Thank you.`);
      }
    } else if (type === "concise") {
      const cleaned = base
        .replace(/^(hello|hi|namaste|please|kindly)[,\s]*/i, "")
        .replace(/thank you.*$/i, "")
        .trim();
      setDraftSentence(cleaned.length > 5 ? cleaned : base);
    }
  }

  function handleResetDraft() {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoCountdown(null);
    setDraftSentence(originalSentence || selected?.sentence || "");
    setIsEditing(false);
    isEditingRef.current = false;
  }

  function addClerkCaption(event: FormEvent) {
    event.preventDefault();
    const text = clerkDraft.trim();
    if (!text) return;
    setClerkDraft("");
    ingestCaption(text, false);
  }

  async function handleSend(customText?: string) {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoCountdown(null);

    const text = (customText || draftSentence || selected?.sentence || "").trim();
    if (!text) return;

    if (containsSensitiveCode(text)) {
      setBlocked(true);
      transportRef.current?.stopSpeaking();
      return;
    }

    setBlocked(false);
    setIsEditing(false);
    isEditingRef.current = false;
    setNeedsIntervention(false);

    const msgId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    pushEntry({
      t: Date.now(),
      side: "us",
      source: "tts-sent",
      text,
      redacted: false,
    });

    roomRef.current?.send({
      type: "user-tts",
      text,
      timestamp: Date.now(),
      msgId,
    });

    void fetch("/api/gloss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.json())
      .then((data: { gloss?: string[] }) => {
        if (data.gloss?.length) setGloss(data.gloss);
      })
      .catch(() => {});

    const transport = transportRef.current;
    if (!transport) return;

    // Single-speech guard across caller and clerk tabs on same computer
    if (!tryClaimSpeech(msgId)) return;

    cancelSpeakRef.current = () => transport.stopSpeaking();

    try {
      const cancel = await transport.speak(
        text,
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

  useEffect(() => {
    if (!isEditingRef.current && contextual.length > 0 && (!selected || !draftSentence)) {
      const top = contextual[0];
      setSelected(top);
      setDraftSentence(top.sentence);
      setOriginalSentence(top.sentence);
      if (autoPilotRef.current && !needsIntervention) {
        triggerAutoSpeak(top.sentence, 2.5);
      }
    }
  }, [contextual, needsIntervention]);

  function handleDtmf(key: string) {
    transportRef.current?.sendDTMF(key);
    roomRef.current?.send({
      type: "dtmf",
      digit: key,
      timestamp: Date.now(),
    });
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

  function handleSwitchLanguage(newUiLang: UiLanguage, newCallLang?: "hi" | "en") {
    const targetCallLang: "hi" | "en" =
      newCallLang ?? (newUiLang === "hi" ? "hi" : "en");

    applyUiLanguage(newUiLang);
    setUiLanguage(newUiLang);
    setCallLanguage(targetCallLang);

    const profile = loadProfile();
    saveProfile({
      ...profile,
      uiLanguage: newUiLang,
      callLanguage: targetCallLang,
      voice: targetCallLang === "hi" ? "aditi" : "alia",
    });

    const session = loadCallSession();
    if (session) {
      saveCallSession({
        ...session,
        callLanguage: targetCallLang,
      });
    }

    const playbook = getPlaybook(playbookId);
    if (playbook) {
      setPlaybookName(playbookTitle(playbook, newUiLang));
      setPlaybookGoal(
        playbook.goal[targetCallLang] ?? playbook.goal.en ?? ""
      );
    }

    const newDisclosure = disclosureSuggestion(name, targetCallLang, accessNeed);
    if (!selected || selected.id === "disclosure") {
      setSelected(newDisclosure);
    } else {
      const nextAlways = alwaysPresentSuggestions(targetCallLang);
      const matchAlways = nextAlways.find((item) => item.id === selected.id);
      if (matchAlways) {
        setSelected(matchAlways);
      } else {
        setSelected(newDisclosure);
      }
    }

    roomRef.current?.send({
      type: "session-sync",
      callerName: name,
      playbookId,
      callLanguage: targetCallLang,
      facts,
    });
  }

  function endCall(asRefused = false) {
    roomRef.current?.send({
      type: "call-ended",
      timestamp: Date.now(),
    });

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
    <main
      key={`${uiLanguage}-${callLanguage}`}
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6"
    >
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
            id="call-autopilot-toggle"
            onClick={() => {
              const next = !autoPilot;
              setAutoPilot(next);
              autoPilotRef.current = next;
              if (!next) {
                if (autoTimerRef.current) clearInterval(autoTimerRef.current);
                autoTimerRef.current = null;
                setAutoCountdown(null);
              } else if (selected && !needsIntervention && !isEditing) {
                triggerAutoSpeak(draftSentence || selected.sentence, 2.5);
              }
            }}
            aria-pressed={autoPilot}
            className={`min-h-11 rounded-full px-3.5 text-xs font-semibold transition-all ${
              autoPilot
                ? "bg-teal-600 text-white shadow-sm border border-teal-500"
                : "border border-[var(--border)] bg-raised text-[var(--muted)]"
            }`}
          >
            {autoPilot ? "🤖 Auto-Pilot: ON" : "👤 Auto-Pilot: PAUSED"}
          </button>
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

      {/* Dynamic In-Call Language Switcher Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-card/90 backdrop-blur-sm px-4 py-2.5 shadow-sm animate-fade-up">
        {/* Quick Full-Page Language Switcher */}
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
                id={`switch-lang-${lang.id}`}
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

        {/* Spoken Voice Language Accent Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1">
            <span>🗣️</span>
            <span>Voice:</span>
          </span>
          <div className="inline-flex rounded-full bg-paper p-0.5 border border-[var(--border)]">
            <button
              type="button"
              id="switch-voice-en"
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
              id="switch-voice-hi"
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
          showIsl ? "md:grid-cols-[1fr_380px] lg:grid-cols-[1fr_420px]" : ""
        }`}
      >
        <CaptionFeed
          entries={entries}
          liveText={livePartial || (liveCaptions && !entries.length ? t("call.listening") : "")}
          liveSide="clerk"
        />
        {showIsl ? (
          <div className="flex flex-col gap-2">
            <ISLAvatar visible gloss={gloss} />
          </div>
        ) : null}
      </section>

      {/* Clerk Operator Status & Direct Sync Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                clerkPeerConnected ? "bg-emerald-400" : "bg-teal-400"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                clerkPeerConnected ? "bg-emerald-500" : "bg-teal-500"
              }`}
            />
          </span>
          <span className="font-semibold text-ink">
            {clerkPeerConnected ? "Clerk Desk Online & Synchronized" : "Waiting for Clerk Desk..."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/clerk"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--signal)] bg-[rgba(14,124,114,0.08)] px-3 py-1.5 text-xs font-semibold text-[var(--signal)] hover:bg-[rgba(14,124,114,0.15)] transition-colors"
          >
            <span>Open Clerk Operator Console ↗</span>
          </Link>
        </div>
      </div>

      {/* Developer / Quick Demo Simulation Drawer (Collapsible) */}
      <details className="mt-2 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer hover:text-ink select-none py-1">
          Single-screen testing? Click to type manual clerk line
        </summary>
        <form onSubmit={addClerkCaption} className="mt-2 flex gap-2">
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
          <button type="submit" className="ghost-btn min-h-12 px-4">
            {t("call.add_caption")}
          </button>
        </form>
      </details>

      {/* Response Station & Auto-Pilot Engine */}
      <div className="mt-4 rounded-[1.75rem] border border-[var(--border)] bg-raised p-4 shadow-card">
        {/* Auto-Pilot Intervention Alert */}
        {needsIntervention && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <div>
                <strong className="font-bold">Intervention Needed:</strong>
                <p className="mt-0.5">{interventionReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Auto-Pilot Speaking Countdown Bar */}
        {autoCountdown !== null && !needsIntervention && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-500/40 bg-teal-500/10 p-3 text-xs text-teal-900 dark:text-teal-200">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
              </span>
              <div>
                <span className="font-bold">🤖 Auto-Pilot speaking automatically in {autoCountdown}s</span>
                <p className="text-[11px] opacity-80">Edit response below or select suggestion to pause.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (autoTimerRef.current) clearInterval(autoTimerRef.current);
                  autoTimerRef.current = null;
                  setAutoCountdown(null);
                  setIsEditing(true);
                  isEditingRef.current = true;
                }}
                className="rounded-lg bg-black/10 dark:bg-white/10 px-2.5 py-1 font-semibold hover:bg-black/20 transition-colors"
              >
                ⏸️ Pause
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                className="rounded-lg bg-teal-600 px-3 py-1 font-semibold text-white hover:bg-teal-500 shadow-sm transition-colors"
              >
                ⚡ Speak Now
              </button>
            </div>
          </div>
        )}

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
            setDraftSentence(suggestion.sentence);
            setOriginalSentence(suggestion.sentence);
            setBlocked(false);
            setIsEditing(false);
            isEditingRef.current = false;
            setNeedsIntervention(false);
            if (autoPilotRef.current) {
              triggerAutoSpeak(suggestion.sentence, 2.5);
            }
          }}
        />

        {/* Live Editable Proposed Speech Area */}
        <div className="mt-4 rounded-2xl bg-paper p-4 shadow-sm border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-[var(--muted)] flex items-center gap-1.5">
              <span>💬</span>
              <span>{t("call.selected_hint")} (Editable)</span>
            </span>
            {isEditing ? (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                ✏️ Editing Active (Incoming captions locked)
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                ✨ Ready to speak
              </span>
            )}
          </div>

          {blocked ? (
            <p className="mt-2 text-base font-semibold text-danger">
              {t("call.otp_blocked")}
            </p>
          ) : (
            <textarea
              id="active-speech-draft"
              value={draftSentence}
              onChange={(e) => {
                setDraftSentence(e.target.value);
                setIsEditing(true);
                isEditingRef.current = true;
                if (autoTimerRef.current) {
                  clearInterval(autoTimerRef.current);
                  autoTimerRef.current = null;
                }
                setAutoCountdown(null);
              }}
              rows={3}
              placeholder={t("call.pick_suggestion")}
              className="field mt-2 w-full font-serif text-xl leading-snug resize-none rounded-xl p-3 border border-[var(--border)] bg-raised focus:bg-paper transition-colors"
            />
          )}

          {/* AI Reframe & Quick Style Tweaks */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]">
            <span className="text-[11px] font-semibold text-[var(--muted)] mr-1">
              ✨ Reframe:
            </span>
            <button
              type="button"
              id="reframe-urgent-btn"
              onClick={() => handleReframe("urgent")}
              className="rounded-full bg-red-500/10 border border-red-500/25 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-500/20 transition-all"
              title="Prepend emergency urgency to prioritize"
            >
              🚨 More Urgent
            </button>
            <button
              type="button"
              id="reframe-polite-btn"
              onClick={() => handleReframe("polite")}
              className="rounded-full bg-sky-500/10 border border-sky-500/25 px-2.5 py-1 text-xs font-semibold text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition-all"
              title="Add respectful greeting and assistance request"
            >
              🤝 More Polite
            </button>
            <button
              type="button"
              id="reframe-concise-btn"
              onClick={() => handleReframe("concise")}
              className="rounded-full bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-all"
              title="Strip pleasantries into direct factual statement"
            >
              ⚡ Direct / Short
            </button>

            {isEditing && (
              <button
                type="button"
                id="reset-draft-btn"
                onClick={handleResetDraft}
                className="ml-auto rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
                title="Revert back to AI suggested text"
              >
                🔄 Reset to AI Draft
              </button>
            )}
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            id="call-send-btn"
            onClick={() => void handleSend()}
            disabled={!draftSentence.trim()}
            className="gold-btn min-h-16 flex-1 text-xl flex items-center justify-center gap-2"
          >
            <span>{t("call.send")}</span>
            <span className="text-sm opacity-70">↵ Speak</span>
          </button>
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
