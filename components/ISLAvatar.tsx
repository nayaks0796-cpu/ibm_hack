"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import {
  attachCwasaHost,
  avatarCanvasReady,
  bootCwasa,
  detachCwasaHost,
  glossToSigml,
  playSigml,
} from "@/lib/isl/cwasa";

interface Props {
  gloss?: string[];
  visible?: boolean;
}

export default function ISLAvatar({ gloss = [], visible = true }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState("HELLO");

  useEffect(() => {
    if (!visible) return;
    const slot = slotRef.current;
    if (!slot) return;

    let cancelled = false;
    const host = attachCwasaHost(slot);

    const markReady = () => {
      if (!cancelled) setStatus("ready");
    };

    const observer = new MutationObserver(() => {
      if (avatarCanvasReady()) markReady();
    });
    observer.observe(host, { childList: true, subtree: true });
    if (avatarCanvasReady()) markReady();

    void bootCwasa()
      .then(markReady)
      .catch(() => {
        if (cancelled) return;
        if (avatarCanvasReady()) markReady();
        else setStatus("error");
      });

    return () => {
      cancelled = true;
      observer.disconnect();
      detachCwasaHost(slot);
    };
  }, [visible]);

  useEffect(() => {
    if (status !== "ready" || gloss.length === 0) return;
    const label = gloss.join(" ");
    setPlaying(label);
    void glossToSigml(gloss)
      .then((sigml) => playSigml(sigml))
      .catch(() => undefined);
  }, [gloss, status]);

  return (
    <div
      className={`relative flex aspect-video w-full overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-ink text-paper/80 ${
        visible ? "" : "hidden"
      }`}
    >
      <div ref={slotRef} className="h-full w-full" />

      {status === "loading" ? (
        <p className="pointer-events-none absolute inset-x-3 top-3 text-xs font-semibold uppercase tracking-[0.14em] text-paper/70">
          {t("call.isl_loading")}
        </p>
      ) : null}

      {status === "error" ? (
        <p className="pointer-events-none absolute inset-x-3 top-3 text-xs font-semibold text-paper/80">
          {t("call.isl_error")}
        </p>
      ) : null}

      <p className="pointer-events-none absolute inset-x-3 bottom-3 text-xs font-semibold uppercase tracking-[0.14em] text-paper/70">
        {playing}
      </p>
    </div>
  );
}
