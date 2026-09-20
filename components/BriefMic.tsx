"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { t } from "@/lib/i18n";
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
import { RoomTransport } from "@/lib/transport/RoomTransport";
import type { CallLanguage } from "@/lib/types";

type STTController = ReturnType<typeof createScribeSTT>;

export type BriefMicUi = {
  listening: boolean;
  connecting: boolean;
  error: string | null;
  partial: string;
  sessionHasFinal: boolean;
};

export function spokenFieldValue(
  value: string,
  ui: Pick<BriefMicUi, "partial" | "sessionHasFinal">,
  active: boolean
): string {
  if (!active || !ui.partial) return value;
  if (ui.sessionHasFinal && value.trim()) return `${value.trim()} ${ui.partial}`;
  return ui.partial;
}

export function useSpeakToText({
  callLanguage,
  name,
  facts,
  onTranscript,
}: {
  callLanguage: CallLanguage;
  name: string;
  facts: Record<string, string>;
  onTranscript: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionHasFinal, setSessionHasFinal] = useState(false);

  const transportRef = useRef<RoomTransport | null>(null);
  const sttRef = useRef<STTController | null>(null);
  const unsubAudioRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef(0);
  const listeningRef = useRef(false);
  const connectingRef = useRef(false);
  const pendingReleaseRef = useRef(Promise.resolve());
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  function failCopy(kind: ScribeFailKind): string {
    return t(scribeFailKey("start", kind));
  }

  function release() {
    sessionRef.current += 1;
    unsubAudioRef.current?.();
    unsubAudioRef.current = null;
    const disconnect = sttRef.current?.disconnect();
    sttRef.current = null;
    transportRef.current?.stopInbound();
    transportRef.current = null;
    listeningRef.current = false;
    connectingRef.current = false;
    setListening(false);
    setConnecting(false);
    setPartial("");
    setSessionHasFinal(false);
    pendingReleaseRef.current = Promise.resolve(disconnect).then(() => {
      markScribeReleased();
    });
  }

  const releaseRef = useRef(release);
  releaseRef.current = release;

  useEffect(() => {
    return () => releaseRef.current();
  }, []);

  async function startListening() {
    if (connectingRef.current || listeningRef.current) return;
    setError(null);
    setPartial("");
    setSessionHasFinal(false);
    connectingRef.current = true;
    setConnecting(true);
    const session = ++sessionRef.current;

    await pendingReleaseRef.current;
    if (session !== sessionRef.current) return;

    await runExclusiveScribe(async () => {
      if (session !== sessionRef.current) return;
      await waitScribeCooldown();
      if (session !== sessionRef.current) return;

      const transport = new RoomTransport();
      transportRef.current = transport;

      try {
        await transport.startInbound();
      } catch {
        if (session !== sessionRef.current) return;
        transport.stopInbound();
        transportRef.current = null;
        connectingRef.current = false;
        setConnecting(false);
        setError(t("start.brief_mic_error"));
        return;
      }

      if (session !== sessionRef.current) {
        if (transportRef.current === transport) {
          transport.stopInbound();
          transportRef.current = null;
        }
        return;
      }

      const controller = createScribeSTT(
        callLanguage,
        (text, isFinal) => {
          if (session !== sessionRef.current) return;
          const cleaned = text.trim();
          if (!cleaned) return;
          if (!isFinal) {
            setPartial(cleaned);
            return;
          }
          setPartial("");
          setSessionHasFinal(true);
          onTranscriptRef.current(cleaned);
        },
        keytermsFromFacts(name, facts),
        (error) => {
          if (session !== sessionRef.current) return;
          release();
          setError(failCopy(classifyScribeFailure({ message: error.message })));
        }
      );
      sttRef.current = controller;
      unsubAudioRef.current = transport.onInboundAudio((chunk) => {
        controller.sendAudio(chunk);
      });

      const result = await connectScribeSession(controller, {
        isCurrent: () => session === sessionRef.current,
      });
      if (session !== sessionRef.current) {
        if (sttRef.current === controller) {
          void controller.disconnect();
          sttRef.current = null;
        }
        return;
      }
      if (!result.ok) {
        release();
        if (result.kind !== "cancelled") setError(failCopy(result.kind));
        return;
      }
      connectingRef.current = false;
      listeningRef.current = true;
      setConnecting(false);
      setListening(true);
    });

    if (session === sessionRef.current && !listeningRef.current) {
      connectingRef.current = false;
      setConnecting(false);
    }
  }

  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;

  const stop = useCallback(() => {
    releaseRef.current();
  }, []);

  const start = useCallback(() => {
    if (connectingRef.current || listeningRef.current) {
      releaseRef.current();
    }
    void startListeningRef.current();
  }, []);

  const toggle = useCallback(() => {
    if (listeningRef.current || connectingRef.current) {
      releaseRef.current();
      return;
    }
    void startListeningRef.current();
  }, []);

  const ui: BriefMicUi = {
    listening,
    connecting,
    error,
    partial,
    sessionHasFinal,
  };

  return {
    ...ui,
    active: listening || connecting,
    ui,
    start,
    stop,
    toggle,
  };
}

export function SpeakButton({
  listening,
  connecting,
  onClick,
  compact = false,
}: {
  listening: boolean;
  connecting: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const active = listening || connecting;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? t("start.brief_mic_stop") : t("start.brief_mic")}
      className={`relative inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${
        compact ? "min-h-14 min-w-14 rounded-full px-4 text-sm" : "min-h-12 rounded-full px-5 text-sm"
      } ${
        listening
          ? "bg-[var(--signal)] text-white shadow-[0_10px_28px_rgba(14,124,114,0.28)]"
          : compact
            ? "bg-[#f2b705] text-[#1b1b19] hover:brightness-105"
            : "gold-btn"
      }`}
    >
      {listening ? (
        <span className="pointer-events-none absolute -inset-1 rounded-full border border-[var(--signal)]/35" />
      ) : null}
      <MicIcon listening={listening} />
      <span className={compact ? "hidden sm:inline" : undefined}>
        {connecting
          ? t("start.brief_connecting")
          : listening
            ? t("start.brief_mic_stop")
            : t("start.brief_mic")}
      </span>
    </button>
  );
}

export default function BriefMic({
  callLanguage,
  name,
  facts,
  onTranscript,
  onUiChange,
  stopRef,
}: {
  callLanguage: CallLanguage;
  name: string;
  facts: Record<string, string>;
  onTranscript: (text: string) => void;
  onUiChange?: (ui: BriefMicUi) => void;
  stopRef?: MutableRefObject<(() => void) | null>;
}) {
  const speak = useSpeakToText({ callLanguage, name, facts, onTranscript });
  const onUiChangeRef = useRef(onUiChange);
  onUiChangeRef.current = onUiChange;
  const stop = speak.stop;

  useEffect(() => {
    if (stopRef) stopRef.current = stop;
    return () => {
      if (stopRef) stopRef.current = null;
    };
  }, [stopRef, stop]);

  useEffect(() => {
    onUiChangeRef.current?.({
      listening: speak.listening,
      connecting: speak.connecting,
      error: speak.error,
      partial: speak.partial,
      sessionHasFinal: speak.sessionHasFinal,
    });
  }, [
    speak.listening,
    speak.connecting,
    speak.error,
    speak.partial,
    speak.sessionHasFinal,
  ]);

  return (
    <SpeakButton
      listening={speak.listening}
      connecting={speak.connecting}
      onClick={speak.toggle}
    />
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-[1.15rem] w-[1.15rem] ${listening ? "animate-pulse" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <rect x="9" y="3.2" width="6" height="10.5" rx="3" />
      <path d="M7 11.2a5 5 0 0 0 10 0" strokeLinecap="round" />
      <path d="M12 16.4V20.5" strokeLinecap="round" />
      <path d="M9.5 20.5h5" strokeLinecap="round" />
    </svg>
  );
}
