"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/lib/types";
import { t } from "@/lib/i18n";

export default function CaptionFeed({ entries }: { entries: TranscriptEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  return (
    <div
      className="flex min-h-[16rem] flex-1 flex-col gap-3 overflow-y-auto px-1 py-2"
      aria-live="polite"
    >
      {entries.length === 0 ? (
        <p className="flex min-h-[12rem] flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--setu-line)] bg-[var(--setu-card)] px-4 py-8 text-center text-base text-[var(--setu-muted)]">
          {t("call.clerk_input_placeholder")}
        </p>
      ) : (
        entries.map((entry, index) => {
          const isUs = entry.side === "us";
          return (
            <article
              key={`${entry.t}-${index}`}
              className={`rounded-2xl border px-4 py-3 ${
                isUs
                  ? "ml-6 border-[#9ad4c4] bg-[#e8f6f1]"
                  : "mr-6 border-[#c5d4e8] bg-[#eef3f9]"
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--setu-muted)]">
                {isUs ? t("call.you") : t("call.clerk")}
              </p>
              <p className="text-xl font-medium leading-snug text-[var(--setu-ink)]">
                {entry.text}
              </p>
              </article>
          );
        })
      )}
      <div ref={endRef} />
    </div>
  );
}
