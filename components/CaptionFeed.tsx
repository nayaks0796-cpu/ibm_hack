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
        <p className="flex min-h-[12rem] flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border)] bg-raised px-4 py-8 text-center text-base text-[var(--muted)]">
          {t("call.clerk_input_placeholder")}
        </p>
      ) : (
        entries.map((entry, index) => {
          const isUs = entry.side === "us";
          return (
            <article
              key={`${entry.t}-${index}`}
              className={`rounded-2xl border border-[var(--border)] px-4 py-3 animate-fade-up ${
                isUs ? "ml-6 bg-signal/10" : "mr-6 bg-raised"
              }`}
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                {isUs ? t("call.you") : t("call.clerk")}
              </p>
              <p className="font-serif text-xl leading-snug">{entry.text}</p>
            </article>
          );
        })
      )}
      <div ref={endRef} />
    </div>
  );
}
