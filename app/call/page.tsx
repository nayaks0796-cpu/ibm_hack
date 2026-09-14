"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import CaptionFeed from "@/components/CaptionFeed";
import DTMFPad from "@/components/DTMFPad";
import ISLAvatar from "@/components/ISLAvatar";
import ReplySuggestions from "@/components/ReplySuggestions";
import SilenceRing, { type RingState } from "@/components/SilenceRing";
import UnmuteButton from "@/components/UnmuteButton";
import { containsSensitiveCode } from "@/lib/guard/otp";
import { redact } from "@/lib/guard/redact";
import { detectReferenceNumbers } from "@/lib/guard/refnum";
import { t } from "@/lib/i18n";
import { getPlaybook, playbookTitle } from "@/lib/playbooks";
import {
  appendTranscriptEntry,
  clearCallSession,
  loadCallSession,
  loadCurrentTranscript,
  loadFacts,
  loadProfile,
  saveCallSession,
  saveOutcome,
} from "@/lib/store";
import {
  alwaysPresentSuggestions,
  contextualSuggestions,
  disclosureSuggestion,
} from "@/lib/suggestions/skeleton";
import { RoomTransport } from "@/lib/transport/RoomTransport";
import type { ReplySuggestion, TranscriptEntry } from "@/lib/types";

const LINE_LABEL = {
  active: "call.line_active",
  silent: "call.line_silent",
  disconnected: "call.line_disconnected",
} as const;

export default function CallPage() {
  const router = useRouter();
  const transportRef = useRef<RoomTransport | null>(null);
  const cancelSpeakRef = useRef<(() => void) | null>(null);

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
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [callLanguage, setCallLanguage] = useState<"hi" | "en">("hi");
  const [playbookName, setPlaybookName] = useState("Power cut");

  if (!transportRef.current) {
    transportRef.current = new RoomTransport();
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
    setFacts(loadFacts());
    setCallLanguage(session.callLanguage);
    setShowIsl(profile.islAvatar);
    setPlaybookName(playbook ? playbookTitle(playbook) : session.playbookId);
    setEntries(loadCurrentTranscript());
    setSelected(disclosureSuggestion(profile.name, session.callLanguage));
    setReady(true);

    const transport = transportRef.current;
    if (!transport) return;

    const unsubscribe = transport.onLineState(setLineState);
    void transport.startInbound();

    return () => {
      unsubscribe();
      transport.stopInbound();
    };
  }, [router]);

  const contextual = useMemo(
    () => [
      disclosureSuggestion(name, callLanguage),
      ...contextualSuggestions(facts, callLanguage),
    ],
    [name, facts, callLanguage]
  );
  const alwaysPresent = useMemo(
    () => alwaysPresentSuggestions(callLanguage),
    [callLanguage]
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

  function addClerkCaption(event: FormEvent) {
    event.preventDefault();
    const text = clerkDraft.trim();
    if (!text) return;

    pushEntry({
      t: Date.now(),
      side: "clerk",
      source: "stt",
      text,
      redacted: false,
    });
    setClerkDraft("");

    const found = detectReferenceNumbers(text);
    if (found[0]) setHeardRef(found[0]);
  }

  async function handleSend() {
    if (!selected) return;

    if (containsSensitiveCode(selected.sentence)) {
      setBlocked(true);
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

    try {
      const cancel = await transportRef.current?.speak(
        selected.sentence,
        callLanguage
      );
      cancelSpeakRef.current = cancel ?? null;
    } catch {
      cancelSpeakRef.current = null;
    }
  }

  function handleUnmute() {
    cancelSpeakRef.current?.();
    cancelSpeakRef.current = null;
    setUnmuted((current) => !current);
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

  function pinHeard() {
    const session = loadCallSession();
    if (!session || !heardRef) return;
    saveCallSession({ ...session, pinnedReferenceNumber: heardRef });
    setHeardRef(null);
  }

  function endCall() {
    const session = loadCallSession();
    if (!session) {
      router.replace("/start");
      return;
    }

    transportRef.current?.stopInbound();
    const transcript = loadCurrentTranscript();
    saveOutcome({
      playbookId: session.playbookId,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      result: "resolved",
      referenceNumber: session.pinnedReferenceNumber ?? "COMP-4821",
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
          <span className="rounded-full bg-highlight/20 px-3 py-1 text-xs font-semibold text-highlight-ink">
            {t("call.demo_voice")}
          </span>
          <button
            type="button"
            onClick={endCall}
            className="min-h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          >
            {t("call.end")}
          </button>
        </div>
      </header>

      {heardRef ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper animate-fade-up">
          <p className="text-base font-semibold">
            {t("call.pin_prompt", { ref: heardRef })}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={pinHeard} className="gold-btn min-h-11">
              {t("call.pin_yes")}
            </button>
            <button
              type="button"
              onClick={() => setHeardRef(null)}
              className="min-h-11 rounded-full border border-white/25 px-4 text-sm font-semibold"
            >
              {t("call.pin_no")}
            </button>
          </div>
        </div>
      ) : null}

      <section className="mt-4 grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_220px]">
        <CaptionFeed entries={entries} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowIsl((value) => !value)}
            className="ghost-btn"
          >
            {showIsl ? t("call.isl_hide") : t("call.isl_show")}
          </button>
          <ISLAvatar visible={showIsl} />
        </div>
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
