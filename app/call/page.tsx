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
import UnmuteButton from "@/components/UnmuteButton";
import { answerPreview, looksLikeGoalAnswer } from "@/lib/guard/answer";
import { createScribeSTT, keytermsFromFacts } from "@/lib/elevenlabs/scribe";
import {
  classifyScribeFailure,
  connectScribeSession,
  markScribeReleased,
  runExclusiveScribe,
  scribeFailKey,
  waitScribeCooldown,
  type ScribeFailKind,
} from "@/lib/elevenlabs/scribeConnect";
import { containsSensitiveCode } from "@/lib/guard/otp";
import { redact } from "@/lib/guard/redact";
import {
  detectReferenceNumbers,
  isClerkSpokenReference,
} from "@/lib/guard/refnum";
import { applyUiLanguage, t, UI_LANGUAGES } from "@/lib/i18n";
import { decideCallOutcome } from "@/lib/outcome/decide";
import { detectRefusal } from "@/lib/outcome/refuse";
import {
  getPlaybook,
  playbookChannel,
  playbookKeyterms,
  playbookTitle,
} from "@/lib/playbooks";
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
  detectClerkIntent,
  disclosureSuggestion,
  emergencyOpenerSuggestion,
  finalizeReplySuggestions,
} from "@/lib/suggestions/skeleton";
import { RoomTransport } from "@/lib/transport/RoomTransport";
import { tryClaimSpeech } from "@/lib/transport/speechLock";
import { resolveVoiceId } from "@/lib/voices";
import type {
  AccessNeed,
  PlaybookChannel,
  ReplySuggestion,
  TranscriptEntry,
  UiLanguage,
} from "@/lib/types";

const LINE_LABEL = {
  active: "call.line_active",
  silent: "call.line_silent",
  disconnected: "call.line_disconnected",
  ringing: "call.line_ringing",
} as const;

const SILENT_CLERK_SEC = 10;

type SttController = ReturnType<typeof createScribeSTT>;

export default function CallPage() {
  const router = useRouter();
  const transportRef = useRef<RoomTransport | null>(null);
  const cancelSpeakRef = useRef<(() => void) | null>(null);
  const sttRef = useRef<SttController | null>(null);
  const unsubAudioRef = useRef<(() => void) | null>(null);
  const ingestRef = useRef<(text: string, fromVoice: boolean) => void>(
    () => undefined
  );
  const handleSendRef = useRef<(text?: string) => Promise<void>>(async () => undefined);
  const maybeSpeakSosOpenerRef = useRef<() => void>(() => undefined);
  const connectingRef = useRef(false);
  const roomRef = useRef<CallRoom | null>(null);

  const [ready, setReady] = useState(false);
  const [clerkPeerConnected, setClerkPeerConnected] = useState(false);
  const clerkPeerConnectedRef = useRef(false);
  clerkPeerConnectedRef.current = clerkPeerConnected;
  const [lineState, setLineState] = useState<RingState>("disconnected");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [clerkDraft, setClerkDraft] = useState("");
  const [selected, setSelected] = useState<ReplySuggestion | null>(null);
  const [draftSentence, setDraftSentence] = useState("");
  const [originalSentence, setOriginalSentence] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  // Auto-select fills the draft only — never speaks. Hard rule: Send alone speaks.
  const [autoSelect, setAutoSelect] = useState(false);
  const autoSelectRef = useRef(false);
  autoSelectRef.current = autoSelect;

  const [needsIntervention, setNeedsIntervention] = useState(false);
  const needsInterventionRef = useRef(false);
  needsInterventionRef.current = needsIntervention;
  const [interventionReason, setInterventionReason] = useState("");
  const [userBrief, setUserBrief] = useState("");
  const [unmuted, setUnmuted] = useState(false);
  const unmutedRef = useRef(false);
  unmutedRef.current = unmuted;
  const [blocked, setBlocked] = useState(false);
  const [heardRef, setHeardRef] = useState<string | null>(null);
  const [heardAnswer, setHeardAnswer] = useState<string | null>(null);
  const [channel, setChannel] = useState<PlaybookChannel>("phone-human");
  const [isEmergency, setIsEmergency] = useState(false);
  const isEmergencyRef = useRef(false);
  const pendingSosOpenerRef = useRef<string | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const glossAbortRef = useRef<AbortController | null>(null);
  const sosOpenerSentRef = useRef(false);
  const [sosAwaitingGreeting, setSosAwaitingGreeting] = useState(false);
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
  const [demoVoice, setDemoVoice] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState(false);
  const [captionsFailed, setCaptionsFailed] = useState(false);
  const [captionsFailKind, setCaptionsFailKind] = useState<ScribeFailKind>("error");
  const [micNeeded, setMicNeeded] = useState(false);
  const [livePartial, setLivePartial] = useState("");
  const [updatingReplies, setUpdatingReplies] = useState(false);
  const [clerkRefused, setClerkRefused] = useState(false);
  const [silentFor, setSilentFor] = useState(0);
  const [lastSpokenSentence, setLastSpokenSentence] = useState("");

  if (!transportRef.current) {
    transportRef.current = new RoomTransport();
  }

  async function bootLiveCaptions() {
    const transport = transportRef.current;
    if (!transport || connectingRef.current || sttRef.current) return;
    connectingRef.current = true;
    setCaptionsFailed(false);

    try {
      await transport.startInbound();
      setMicNeeded(false);
    } catch {
      setMicNeeded(true);
      connectingRef.current = false;
      return;
    }

    const dropScribe = (kind: ScribeFailKind = "error") => {
      unsubAudioRef.current?.();
      unsubAudioRef.current = null;
      const disconnect = sttRef.current?.disconnect();
      sttRef.current = null;
      setLiveCaptions(false);
      setLivePartial("");
      setCaptionsFailKind(kind);
      setCaptionsFailed(true);
      void Promise.resolve(disconnect).then(() => markScribeReleased());
    };

    const profile = loadProfile();
    const session = loadCallSession();
    const lang = session?.callLanguage ?? profile.callLanguage;
    const controller = createScribeSTT(
      lang,
      (text, isFinal) => {
        if (!isFinal) {
          setLivePartial(text);
          return;
        }
        setLivePartial("");
        ingestRef.current(text, true);
      },
      keytermsFromFacts(
        profile.name,
        session?.facts ?? {},
        playbookKeyterms(getPlaybook(session?.playbookId ?? ""))
      ),
      (error) => dropScribe(classifyScribeFailure({ message: error.message }))
    );
    sttRef.current = controller;
    unsubAudioRef.current = transport.onInboundAudio((chunk) => {
      controller.sendAudio(chunk);
    });

    const result = await runExclusiveScribe(async () => {
      await waitScribeCooldown();
      return connectScribeSession(controller);
    });
    if (!result.ok) {
      dropScribe(result.kind === "cancelled" ? "busy" : result.kind);
    } else {
      setLiveCaptions(true);
      setCaptionsFailed(false);
    }
    connectingRef.current = false;
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
    setChannel(playbook ? playbookChannel(playbook) : "phone-human");
    const emergency = Boolean(playbook?.emergency);
    setIsEmergency(emergency);
    isEmergencyRef.current = emergency;
    setEntries(loadCurrentTranscript());

    const brief = session.userBrief?.trim();
    setUserBrief(brief || "");

    const disclosure = disclosureSuggestion(
      profile.name,
      session.callLanguage,
      profile.accessNeed,
      playbook ? playbookChannel(playbook) : "phone-human"
    );
    let initialSug: ReplySuggestion = playbook?.emergency
      ? emergencyOpenerSuggestion(
          profile.name,
          session.callLanguage,
          profile.accessNeed,
          session.facts ?? {}
        )
      : disclosure;
    if (brief && !playbook?.emergency) {
      initialSug = {
        id: "brief-intro",
        label: t("call.suggest.state_issue") || "Initial Statement",
        sentence: `${disclosure.sentence} ${brief}`,
      };
    }

    setSelected(initialSug);
    setDraftSentence(initialSug.sentence);
    setOriginalSentence(initialSug.sentence);
    setReady(true);

    if (session.autoSpeakOpener && playbook?.emergency) {
      pendingSosOpenerRef.current = initialSug.sentence;
      sosOpenerSentRef.current = false;
      setSosAwaitingGreeting(true);
    }

    const transport = transportRef.current;
    if (!transport) return;

    const unsubscribe = transport.onLineState((state) => {
      setLineState(state);
      if (state !== "silent") setSilentFor(0);
    });
    void bootLiveCaptions();

    const room = new CallRoom("demo-room", "user");
    roomRef.current = room;

    const syncSession = () => {
      room.send({
        type: "session-sync",
        callerName: profile.name,
        playbookId: session.playbookId,
        callLanguage: session.callLanguage,
        facts: session.facts ?? {},
      });
    };

    syncSession();

    const unsubPeer = room.onPeerChange((connected) => {
      setClerkPeerConnected(connected);
      if (connected) syncSession();
    });

    const unsubRoom = room.onMessage((msg: CallRoomMessage) => {
      if (msg.type === "clerk-caption") {
        if (msg.text) {
          ingestRef.current(msg.text, false);
        }
      } else if (msg.type === "session-sync") {
        if (msg.callLanguage && (msg.callLanguage === "en" || msg.callLanguage === "hi")) {
          setCallLanguage(msg.callLanguage);
        }
      } else if (msg.type === "call-ended") {
        endCall();
      }
    });

    return () => {
      unsubPeer();
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
        transcript: entries,
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
    () => alwaysPresentSuggestions(callLanguage, lastSpokenSentence),
    [callLanguage, uiLanguage, lastSpokenSentence]
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

    // Mic while muted is demo line audio only when no clerk peer is connected.
    // During SOS ringing, the mic is not 112 — ignore it until the desk is online.
    // With a clerk console peer, clerk captions arrive via CallRoom — ignore muted mic.
    if (fromVoice && !unmutedRef.current) {
      if (isEmergencyRef.current && !clerkPeerConnectedRef.current) return;
      if (clerkPeerConnectedRef.current) return;
    }

    const asUser = fromVoice && unmutedRef.current;
    if (asUser) {
      transportRef.current?.stopSpeaking();
      cancelSpeakRef.current = null;
    }

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

        // Detect if clerk asked for missing fact
        const intent = detectClerkIntent(cleaned);
        if (intent === "ask-id" && !facts.consumer_number && !facts.meter_number && !facts.account_number) {
          setNeedsIntervention(true);
          setInterventionReason(
            callLanguage === "hi"
              ? "ऑपरेटर ने उपभोक्ता / मीटर संख्या पूछी है जो उपलब्ध नहीं है। कृपया नीचे लिखें या चुनें।"
              : "Operator asked for your Consumer / Meter Number. Please provide or select below."
          );
        } else if (intent === "ask-place" && !facts.area) {
          setNeedsIntervention(true);
          setInterventionReason(
            callLanguage === "hi"
              ? "ऑपरेटर ने आपका इलाका / क्षेत्र पूछा है। कृपया नीचे लिखें या चुनें।"
              : "Operator asked for your locality / area. Please provide or select below."
          );
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
      if (found[0]) {
        setHeardRef(found[0]);
        setHeardAnswer(null);
      } else {
        const playbook = getPlaybook(playbookId);
        if (
          (playbook?.outcomeKind === "answer" || playbook?.outcomeKind === "acknowledged") &&
          looksLikeGoalAnswer(cleaned)
        ) {
          setHeardAnswer(answerPreview(cleaned));
        }
      }
    }

    if (asUser) return;

    if (!fromVoice) {
      maybeSpeakSosOpenerRef.current();
    }

    const history = loadCurrentTranscript();
    const session = loadCallSession();
    const lang = session?.callLanguage ?? callLanguage;
    const profile = loadProfile();
    suggestAbortRef.current?.abort();
    glossAbortRef.current?.abort();
    const suggestAbort = new AbortController();
    const glossAbort = new AbortController();
    suggestAbortRef.current = suggestAbort;
    glossAbortRef.current = glossAbort;
    setUpdatingReplies(true);
    void fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: suggestAbort.signal,
      body: JSON.stringify({
        caption: stored.text,
        history: history.slice(-6),
        facts,
        goal: playbookGoal,
        callLanguage: lang,
        uiLanguage: profile.uiLanguage,
        playbookId: session?.playbookId ?? playbookId,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`suggest ${res.status}`);
        return res.json();
      })
      .then((data: { suggestions?: ReplySuggestion[] }) => {
        const next = (data.suggestions ?? []).filter(
          (item) =>
            item.sentence &&
            !item.id.startsWith("ap-") &&
            !item.id.startsWith("always-")
        );
        setLlmSuggestions(next);
        if (
          autoSelectRef.current &&
          !isEditingRef.current &&
          !needsInterventionRef.current &&
          next[0]
        ) {
          setSelected(next[0]);
          setDraftSentence(next[0].sentence);
          setOriginalSentence(next[0].sentence);
        }
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        // Keep the last LLM replies if this request failed.
      })
      .finally(() => {
        if (suggestAbortRef.current === suggestAbort) {
          setUpdatingReplies(false);
        }
      });

    void fetch("/api/gloss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: glossAbort.signal,
      body: JSON.stringify({ text: stored.text }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`gloss ${res.status}`);
        return res.json();
      })
      .then((data: { gloss?: string[] }) => {
        if (data.gloss?.length) setGloss(data.gloss);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        // Keep the last gloss if the avatar endpoint is offline.
      });
  }

  ingestRef.current = (text, fromVoice) => ingestCaption(text, fromVoice);

  function handleReframe(type: "urgent" | "polite" | "concise") {
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
    setDraftSentence(originalSentence || selected?.sentence || "");
    setIsEditing(false);
    isEditingRef.current = false;
  }

  function maybeSpeakSosOpener() {
    if (sosOpenerSentRef.current) return;
    if (!pendingSosOpenerRef.current) return;
    if (!clerkPeerConnectedRef.current) return;
    const sentence = pendingSosOpenerRef.current;
    sosOpenerSentRef.current = true;
    pendingSosOpenerRef.current = null;
    setSosAwaitingGreeting(false);
    const current = loadCallSession();
    if (current?.autoSpeakOpener) {
      saveCallSession({ ...current, autoSpeakOpener: false });
    }
    void handleSendRef.current?.(sentence);
  }
  maybeSpeakSosOpenerRef.current = maybeSpeakSosOpener;

  function addClerkCaption(event: FormEvent) {
    event.preventDefault();
    const text = clerkDraft.trim();
    if (!text) return;
    setClerkDraft("");
    ingestCaption(text, false);
  }

  async function handleSend(customText?: string) {
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

    // Claim before broadcasting so the clerk tab cannot steal playback on same machine.
    if (!tryClaimSpeech(msgId)) return;

    setLastSpokenSentence(text);
    pushEntry({
      t: Date.now(),
      side: "us",
      source: "tts-sent",
      text,
      redacted: false,
    });

    const speakLang = loadCallSession()?.callLanguage ?? callLanguage;

    roomRef.current?.send({
      type: "user-tts",
      text,
      lang: speakLang,
      timestamp: Date.now(),
      msgId,
    });

    void fetch("/api/gloss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`gloss ${res.status}`);
        return res.json();
      })
      .then((data: { gloss?: string[] }) => {
        if (data.gloss?.length) setGloss(data.gloss);
      })
      .catch(() => {});

    const transport = transportRef.current;
    if (!transport) return;

    cancelSpeakRef.current = () => transport.stopSpeaking();

    try {
      const cancel = await transport.speak(
        text,
        speakLang,
        loadProfile().voice
      );
      cancelSpeakRef.current = cancel;
      setDemoVoice(transport.lastSpeakSource !== "eleven");
    } catch {
      transport.stopSpeaking();
      cancelSpeakRef.current = null;
    }
  }

  handleSendRef.current = handleSend;

  useEffect(() => {
    if (
      autoSelectRef.current &&
      !isEditingRef.current &&
      !needsInterventionRef.current &&
      contextual.length > 0 &&
      (!selected || !draftSentence)
    ) {
      const top = contextual[0];
      setSelected(top);
      setDraftSentence(top.sentence);
      setOriginalSentence(top.sentence);
    }
  }, [contextual, selected, draftSentence]);

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
    // Pin only numbers the clerk actually said — never invent from our side.
    const transcript = loadCurrentTranscript();
    if (!isClerkSpokenReference(value, transcript)) {
      setHeardRef(null);
      return;
    }
    saveCallSession({ ...session, pinnedReferenceNumber: value });
    setHeardRef(null);
  }

  function pinAnswer(text?: string) {
    const session = loadCallSession();
    const value = text ?? heardAnswer;
    if (!session || !value) return;
    saveCallSession({ ...session, pinnedAnswer: value });
    setHeardAnswer(null);
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
      voice: resolveVoiceId(profile.voice, targetCallLang),
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

    const newDisclosure = disclosureSuggestion(
      name,
      targetCallLang,
      accessNeed,
      channel
    );
    let nextSelected = newDisclosure;
    if (selected?.id === "brief-intro" || userBrief.trim()) {
      nextSelected = {
        id: "brief-intro",
        label: t("call.suggest.state_issue") || "Initial Statement",
        sentence: userBrief.trim()
          ? `${newDisclosure.sentence} ${userBrief.trim()}`
          : newDisclosure.sentence,
      };
    } else if (selected && selected.id !== "disclosure") {
      const nextAlways = alwaysPresentSuggestions(targetCallLang);
      const matchAlways = nextAlways.find((item) => item.id === selected.id);
      if (matchAlways) nextSelected = matchAlways;
    }
    setSelected(nextSelected);
    setDraftSentence(nextSelected.sentence);
    setOriginalSentence(nextSelected.sentence);

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
      pinnedAnswer: session.pinnedAnswer,
      transcript,
      refused: asRefused || clerkRefused,
      outcomeKind: getPlaybook(session.playbookId)?.outcomeKind,
      emergency: Boolean(getPlaybook(session.playbookId)?.emergency),
    });
    saveOutcome({
      playbookId: session.playbookId,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      result: decided.result,
      referenceNumber: decided.referenceNumber,
      capturedAnswer: decided.capturedAnswer,
      outcomeKind: getPlaybook(session.playbookId)?.outcomeKind,
      facts: session.facts ?? {},
      transcript,
    });
    clearCallSession();
    router.push("/outcome");
  }

  if (!ready) {
    return <main className="min-h-screen bg-paper" />;
  }

  const displayRing: RingState = clerkPeerConnected ? lineState : "ringing";

  return (
    <main
      key={`${uiLanguage}-${callLanguage}`}
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6"
    >
      <header className="animate-fade-up rounded-2xl border border-[var(--border)] bg-card/90 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <SilenceRing state={displayRing} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-none">
                  {t(LINE_LABEL[displayRing])}
                </p>
                {liveCaptions ? (
                  <span className="rounded-full bg-signal/15 px-2.5 py-0.5 text-[11px] font-semibold text-signal">
                    {t("call.live_captions")}
                  </span>
                ) : captionsFailed ? (
                  <span className="rounded-full bg-highlight/20 px-2.5 py-0.5 text-[11px] font-semibold text-highlight-ink">
                    {t("call.captions_off")}
                  </span>
                ) : null}
                {demoVoice ? (
                  <span className="rounded-full bg-highlight/20 px-2.5 py-0.5 text-[11px] font-semibold text-highlight-ink">
                    {t("call.demo_voice")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {playbookName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-paper p-1">
              <button
                type="button"
                id="call-autoselect-toggle"
                onClick={() => {
                  setAutoSelect((value) => !value);
                }}
                aria-pressed={autoSelect}
                className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  autoSelect
                    ? "bg-ink text-paper"
                    : "text-[var(--muted)] hover:text-ink"
                }`}
              >
                Auto-select
              </button>
              <button
                type="button"
                onClick={toggleIsl}
                aria-pressed={showIsl}
                className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  showIsl
                    ? "bg-ink text-paper"
                    : "text-[var(--muted)] hover:text-ink"
                }`}
              >
                {showIsl ? t("call.isl_on") : t("call.isl_off")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => endCall()}
              className="min-h-9 rounded-full bg-danger px-4 text-xs font-semibold text-white transition-colors hover:brightness-95"
            >
              {t("call.end")}
            </button>
          </div>
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

      {channel === "in-person" ? (
        <p className="mt-4 rounded-2xl border border-[var(--border)] bg-raised px-4 py-3 text-sm font-semibold">
          {t("call.desk_hint")}
        </p>
      ) : null}

      {!clerkPeerConnected ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-raised px-4 py-4">
          <p className="text-sm font-semibold">{t("call.ringing")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("call.ringing_hint")}</p>
        </div>
      ) : isEmergency && sosAwaitingGreeting ? (
        <div className="mt-4 rounded-2xl border border-signal/30 bg-[rgba(14,124,114,0.08)] px-4 py-4">
          <p className="text-sm font-semibold text-signal">{t("call.picked_up")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("call.waiting_greeting")}</p>
        </div>
      ) : null}

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

      {captionsFailed && !micNeeded ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-raised px-4 py-3">
          <p className="text-sm text-[var(--muted)]">{t(scribeFailKey("call", captionsFailKind))}</p>
          <button
            type="button"
            onClick={() => void bootLiveCaptions()}
            className="ghost-btn min-h-11 px-4"
          >
            {t("call.retry_captions")}
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

      {heardAnswer ? (
        <div className="mt-4">
          <NumberCapturedBanner
            referenceNumber={heardAnswer}
            mode="answer"
            onConfirmPin={pinAnswer}
            onDismiss={() => setHeardAnswer(null)}
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
                setDraftSentence(match.sentence);
                setOriginalSentence(match.sentence);
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
          large={channel === "in-person"}
          clerkLabel={channel === "in-person" ? t("call.official") : undefined}
        />
        {/* Keep mounted when ISL is off — unmounting parks/destroys the WebGL
            canvas and it comes back blank. Park off-screen instead. */}
        <div
          className={
            showIsl
              ? "flex flex-col gap-2"
              : "pointer-events-none fixed left-[-10000px] top-0 h-[280px] w-[320px] opacity-0"
          }
          aria-hidden={!showIsl}
        >
          <ISLAvatar visible={showIsl} gloss={gloss} />
        </div>
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
            {clerkPeerConnected ? t("call.clerk_on_line") : t("call.waiting_clerk")}
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

      {/* Response Station — Send alone speaks */}
      <div className="mt-4 rounded-[1.75rem] border border-[var(--border)] bg-raised p-4 shadow-card">
        {/* Missing-fact intervention alert */}
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
            if (suggestion.action === "dtmf" && suggestion.digit) {
              handleDtmf(suggestion.digit);
              setSelected(suggestion);
              setDraftSentence("");
              setBlocked(false);
              return;
            }
            setSelected(suggestion);
            setDraftSentence(suggestion.sentence);
            setOriginalSentence(suggestion.sentence);
            setBlocked(false);
            setIsEditing(false);
            isEditingRef.current = false;
            setNeedsIntervention(false);
          }}
        />

        {isEmergency ? (
          <div className="mt-3">
            <p className="eyebrow mb-2">{t("call.quick_phrases")}</p>
            <p className="mb-2 text-xs text-[var(--muted)]">{t("call.one_tap_hint")}</p>
            <div className="flex flex-wrap gap-2">
              {(getPlaybook(playbookId)?.quickPhrases ?? []).map((phrase) => {
                const sentence =
                  phrase.sentence[callLanguage] ?? phrase.sentence.en;
                const label =
                  phrase.label[uiLanguage] ?? phrase.label.en ?? phrase.id;
                return (
                  <button
                    key={phrase.id}
                    type="button"
                    onClick={() => void handleSend(sentence)}
                    className="min-h-12 rounded-full bg-danger px-4 text-sm font-semibold text-white"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
                Ready — tap Send to speak
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
          <UnmuteButton
            unmuted={unmuted}
            onToggle={() => {
              setUnmuted((value) => {
                const next = !value;
                if (next) {
                  transportRef.current?.stopSpeaking();
                  cancelSpeakRef.current = null;
                }
                return next;
              });
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowKeypad((value) => !value)}
        className="mt-3 min-h-12 text-sm font-semibold text-signal"
      >
        {showKeypad || channel === "phone-ivr" ? t("call.hide_keypad") : t("call.keypad")}
      </button>
      {showKeypad || channel === "phone-ivr" ? (
        <div className="mt-2 pb-4">
          <DTMFPad onKey={handleDtmf} />
        </div>
      ) : null}
    </main>
  );
}
