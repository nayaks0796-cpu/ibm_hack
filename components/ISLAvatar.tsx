"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import {
  attachCwasaHost,
  avatarCanvasReady,
  bootCwasa,
  detachCwasaHost,
  playSignWord,
  playSigml,
  glossToSigml,
} from "@/lib/isl/cwasa";

interface Props {
  gloss?: string[];
  visible?: boolean;
}

const SAMPLE_SIGNS = [
  { label: "Hello", word: "HELLO" },
  { label: "Help", word: "HELP" },
  { label: "Power", word: "POWER" },
  { label: "Thank you", word: "THANKYOU" },
  { label: "Number", word: "NUMBER" },
  { label: "Hospital", word: "HOSPITAL" },
  { label: "Please", word: "PLEASE" },
  { label: "Problem", word: "PROBLEM" },
];

export default function ISLAvatar({ gloss = [], visible = true }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeWord, setActiveWord] = useState("HELLO");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sequence, setSequence] = useState<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) return;
    const slot = slotRef.current;
    if (!slot) return;

    let cancelled = false;
    const host = attachCwasaHost(slot);

    const markReady = () => {
      if (!cancelled) setStatus("ready");
    };

    if (avatarCanvasReady()) markReady();

    const observer = new MutationObserver(() => {
      if (avatarCanvasReady()) markReady();
    });
    observer.observe(host, { childList: true, subtree: true });

    // Active poll: WebGL canvas can mount asynchronously without triggering parent mutation
    const pollId = setInterval(() => {
      if (avatarCanvasReady()) {
        markReady();
        clearInterval(pollId);
      }
    }, 400);

    void bootCwasa()
      .then(markReady)
      .catch(() => {
        if (cancelled) return;
        if (avatarCanvasReady()) markReady();
        else setStatus("error");
      });

    return () => {
      cancelled = true;
      clearInterval(pollId);
      observer.disconnect();
      detachCwasaHost(slot);
    };
  }, [visible]);

  // Sequential multi-sign animator
  function playSequence(words: string[]) {
    if (words.length === 0) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSequence(words);
    let idx = 0;

    const playStep = (i: number) => {
      if (i >= words.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setActiveIndex(null);
        return;
      }
      const w = words[i].toUpperCase();
      setActiveWord(w);
      setActiveIndex(i);
      void playSignWord(w);
    };

    playStep(0);
    idx = 1;

    timerRef.current = setInterval(() => {
      if (idx >= words.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setActiveIndex(null);
        return;
      }
      playStep(idx);
      idx += 1;
    }, 2200);
  }

  useEffect(() => {
    if ((status !== "ready" && !avatarCanvasReady()) || gloss.length === 0) return;
    if (status !== "ready" && avatarCanvasReady()) setStatus("ready");
    playSequence(gloss);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gloss, status]);

  function playSingle(word: string, index?: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    const upper = word.toUpperCase();
    setActiveWord(upper);
    setActiveIndex(index ?? null);
    void playSignWord(upper);
  }

  const isReady = status === "ready" || avatarCanvasReady();

  return (
    <div
      className={`relative flex flex-col w-full overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-ink text-paper/80 shadow-md ${
        visible ? "" : "hidden"
      }`}
    >
      {/* Avatar Viewport */}
      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
        <div ref={slotRef} className="h-full w-full" />

        {status === "loading" && !isReady && (
          <p className="pointer-events-none absolute inset-x-3 top-3 text-xs font-semibold uppercase tracking-[0.14em] text-paper/70">
            {t("call.isl_loading")}
          </p>
        )}

        {status === "error" && !isReady && (
          <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-lg bg-black/80 px-3 py-2 text-xs text-paper/90 border border-white/10">
            <p>{t("call.isl_error")}</p>
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                void bootCwasa()
                  .then(() => setStatus("ready"))
                  .catch(() => {
                    if (avatarCanvasReady()) setStatus("ready");
                    else setStatus("error");
                  });
              }}
              className="ml-2 rounded bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Current Active Sign Overlay */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between">
          <span className="rounded-md bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-300 border border-amber-400/30">
            {activeWord ? `Sign: ${activeWord}` : "ISL Avatar"}
          </span>

          {sequence.length > 1 && activeIndex !== null && (
            <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-paper/80">
              {activeIndex + 1} / {sequence.length}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Sign Sequence & Quick Controls */}
      <div className="border-t border-white/10 bg-[#121417] p-2.5 space-y-2">
        {/* Active sentence sign chips */}
        {sequence.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Sentence Signs:
            </span>
            {sequence.map((w, idx) => (
              <button
                key={`${w}-${idx}`}
                type="button"
                onClick={() => playSingle(w, idx)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all ${
                  activeIndex === idx
                    ? "bg-amber-400 text-black shadow-sm scale-105"
                    : "bg-white/10 text-paper hover:bg-white/20 border border-white/10"
                }`}
                title={`Click to replay sign: ${w}`}
              >
                {w}
              </button>
            ))}

            {sequence.length > 1 && (
              <button
                type="button"
                onClick={() => playSequence(sequence)}
                className="rounded-full bg-teal-500/20 border border-teal-400/30 px-2 py-0.5 text-[10px] text-teal-300 hover:bg-teal-500/30 ml-auto"
                title="Replay all signs in sequence"
              >
                🔄 Replay All
              </button>
            )}
          </div>
        )}

        {/* Quick Demo Signs */}
        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-white/5">
          <span className="text-[10px] font-medium text-slate-500 mr-1">Demo Signs:</span>
          {SAMPLE_SIGNS.map((s) => (
            <button
              key={s.word}
              type="button"
              onClick={() => playSingle(s.word)}
              className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-teal-500/20 hover:text-teal-300 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
