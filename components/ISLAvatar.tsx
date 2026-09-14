"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { bootCwasa, glossToSigml, playSigml } from "@/lib/isl/cwasa";

interface Props {
  gloss?: string[];
  visible?: boolean;
}

export default function ISLAvatar({ gloss = [], visible = true }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState("HELLO");

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    void bootCwasa()
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        if (document.querySelector(".CWASAAvatar.av0 canvas")) {
          setStatus("ready");
          return;
        }
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (status !== "ready" || gloss.length === 0) return;
    const label = gloss.join(" ");
    setPlaying(label);
    void glossToSigml(gloss).then(playSigml);
  }, [gloss, status]);

  return (
    <div
      className={`relative flex aspect-video w-full overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-ink text-paper/80 ${
        visible ? "" : "hidden"
      }`}
    >
      <div className="CWASAAvatar av0 h-full w-full" />

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
