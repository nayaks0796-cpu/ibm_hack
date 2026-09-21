"use client";

import { t } from "@/lib/i18n";

export interface RefusedOutcomeBannerProps {
  /** Optional reason string or explanation */
  reason?: string;
  /** Callback to terminate the call and record outcome */
  onEndCall?: () => void;
  /** UI language code */
  lang?: string;
}

export default function RefusedOutcomeBanner({
  reason,
  onEndCall,
  lang = "en",
}: RefusedOutcomeBannerProps) {
  return (
    <div
      role="alert"
      className="w-full max-w-md p-4 rounded-2xl border border-rose-200 bg-rose-50/90 dark:border-[rgba(239,111,92,0.35)] dark:bg-[rgba(180,40,30,0.18)] shadow-sm flex flex-col gap-3 transition-all"
    >
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-rose-600 dark:bg-[#ef6f5c] animate-pulse" />
        <h3 className="font-bold text-rose-900 dark:text-[#ef6f5c] text-sm">
          {t("failure.refused_title", undefined, lang)}
        </h3>
      </div>

      <p className="text-xs text-rose-800 dark:text-[rgba(239,111,92,0.75)] leading-relaxed">
        {reason || t("failure.refused_desc", undefined, lang)}
      </p>

      {onEndCall ? (
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={onEndCall}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 dark:bg-[#ef6f5c] hover:bg-rose-700 dark:hover:brightness-110 active:bg-rose-800 text-white dark:text-[#1b0a08] shadow-sm transition-colors cursor-pointer"
          >
            {t("failure.end_call", undefined, lang)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
