"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import {
  attachCwasaHost,
  avatarCanvasReady,
  bootCwasa,
  detachCwasaHost,
  playSignWord,
  refreshCwasaLayout,
} from "@/lib/isl/cwasa";

interface Props {
  gloss?: string[];
  visible?: boolean;
}

export default function ISLAvatar({ gloss = [], visible = true }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeWord, setActiveWord] = useState("HELLO");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sequence, setSequence] = useState<string[]>([]);
  const seqIdRef = useRef(0);
  // Refs that mirror state so effects and callbacks avoid stale closures.
  const activeWordRef = useRef("HELLO");
  // Tracks whether a sequence is actively signing (null = idle).
  const activeIndexRef = useRef<number | null>(null);

  // Boot once on mount. Do not tear down WebGL when the user toggles ISL —
  // the call page parks this panel off-screen instead of unmounting.
  useEffect(() => {
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
  }, []);

  // When ISL is turned back on, the WebGL drawing buffer has been cleared while
  // the panel was parked off-screen, so the idle avatar shows as a blank canvas.
  // Re-attach the host, force a layout pass, and replay the last sign.
  // We do NOT replay if a sequence is already in flight (activeIndex !== null).
  useEffect(() => {
    if (!visible) return;
    const slot = slotRef.current;
    if (slot) attachCwasaHost(slot);

    let cancelled = false;
    const timers: number[] = [];

    const repaint = () => {
      if (cancelled) return;
      refreshCwasaLayout();
      if (!avatarCanvasReady()) return;
      if (status !== "ready") setStatus("ready");
      // Only replay if nothing is currently signing — we don't want to
      // interrupt an active sequence that survived the visibility toggle.
      if (activeIndexRef.current !== null) return;
      void playSignWord(activeWordRef.current || "HELLO");
    };

    // Retry a few times: boot may still be finishing when the panel returns.
    timers.push(window.setTimeout(repaint, 60));
    timers.push(window.setTimeout(repaint, 350));
    timers.push(window.setTimeout(repaint, 900));

    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Sequential multi-sign animator — waits for each sign to finish before
  // starting the next. Checks seqIdRef after every await so a newer gloss
  // can cancel the loop without leaving Animgen in a half-played state.
  async function playSequence(words: string[], seqId: number) {
    const targetWords = words.map((w) => w.trim()).filter(Boolean);
    if (targetWords.length === 0) return;

    setSequence(targetWords);

    for (let i = 0; i < targetWords.length; i += 1) {
      // Check before starting each word — a new gloss may have arrived.
      if (seqIdRef.current !== seqId) return;
      const w = targetWords[i].toUpperCase();
      setActiveWord(w);
      activeWordRef.current = w;
      activeIndexRef.current = i;
      setActiveIndex(i);
      await playSignWord(w);
      // Check again after the await — seqId may have changed while signing.
      if (seqIdRef.current !== seqId) return;
    }

    if (seqIdRef.current === seqId) {
      activeIndexRef.current = null;
      setActiveIndex(null);
    }
  }

  useEffect(() => {
    if (status !== "ready" || gloss.length > 0) return;
    activeWordRef.current = "HELLO";
    void playSignWord("HELLO");
  }, [status]);

  useEffect(() => {
    if ((status !== "ready" && !avatarCanvasReady()) || gloss.length === 0) return;
    if (status !== "ready" && avatarCanvasReady()) setStatus("ready");
    const seqId = seqIdRef.current + 1;
    seqIdRef.current = seqId;
    void playSequence(gloss, seqId);

    return () => {
      seqIdRef.current += 1;
    };
  }, [gloss, status]);

  function playSingle(word: string, index?: number, fromChip = false) {
    const seqId = seqIdRef.current + 1;
    seqIdRef.current = seqId;
    const upper = word.toUpperCase();
    setActiveWord(upper);
    activeWordRef.current = upper;
    activeIndexRef.current = index ?? null;
    setActiveIndex(index ?? null);
    void playSignWord(upper);
  }

  const isReady = status === "ready" || avatarCanvasReady();

  // Words shown as tappable chips when a multi-word gloss is signing
  const showWordChips = sequence.length > 1;

  return (
    <div
      className="relative flex flex-col w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0c0e12] text-white shadow-lg"
    >
      {/* Avatar Viewport */}
      <div className="relative h-[340px] sm:h-[380px] md:h-[420px] w-full overflow-hidden bg-[#0c0e12] flex items-center justify-center">
        <div ref={slotRef} className="h-full w-full flex items-center justify-center [&>div]:!h-full [&>div]:!w-full [&_canvas]:!h-full [&_canvas]:!w-full [&_canvas]:!object-contain" />

        {status === "loading" && !isReady && (
          <p className="pointer-events-none absolute inset-x-3 top-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/85">
            {t("call.isl_loading")}
          </p>
        )}

        {status === "error" && !isReady && (
          <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-lg bg-black/80 px-3 py-2 text-xs text-white border border-white/15">
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
              className="ml-2 rounded bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
            >
              Retry
            </button>
          </div>
        )}

        {/* "Signing: WORD" subtitle — clean, user-facing */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-3">
          {activeWord && isReady ? (
            <span className="rounded-md bg-black/75 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">
              Signing: {activeWord}
            </span>
          ) : (
            <span />
          )}
          {showWordChips && activeIndex !== null && (
            <span className="rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
              {activeIndex + 1} / {sequence.length}
            </span>
          )}
        </div>
      </div>

      {/* Word chips — only shown during multi-word sequences so users can replay individual signs */}
      {showWordChips && (
        <div className="border-t border-white/15 bg-[#1c212b] px-3 py-2.5 flex flex-wrap items-center gap-1.5">
          {sequence.map((w, idx) => (
            <button
              key={`${w}-${idx}`}
              type="button"
              onClick={() => playSingle(w, idx, true)}
              aria-label={`Replay sign: ${w}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-all ${
                activeIndex === idx
                  ? "bg-[var(--signal)] text-white shadow-sm scale-105"
                  : "bg-white/20 text-white border border-white/40 hover:bg-white/30"
              }`}
            >
              {w}
            </button>
          ))}
          {sequence.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const seqId = seqIdRef.current + 1;
                seqIdRef.current = seqId;
                void playSequence(sequence, seqId);
              }}
              aria-label="Replay all signs"
              className="ml-auto rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
            >
              ↺ Replay
            </button>
          )}
        </div>
      )}
    </div>
  );
}
