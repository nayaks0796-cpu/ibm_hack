"use client";

import SilenceRing from "@/components/SilenceRing";
import { t } from "@/lib/i18n";

export interface SilentClerkBannerProps {
  /** True if the clerk has been silent for an extended period */
  isSilent?: boolean;
  /** Silence duration in seconds */
  silenceDurationSec?: number;
  /** Callback when user selects a suggested response action */
  onActionClick?: (actionKey: string) => void;
  /** UI language code */
  lang?: string;
}

export default function SilentClerkBanner({
  isSilent = true,
  silenceDurationSec = 10,
  onActionClick,
  lang = "en",
}: SilentClerkBannerProps) {
  if (!isSilent) return null;

  return (
    <div
      role="alert"
      className="dark-banner-warn w-full max-w-md p-4 rounded-2xl border border-amber-200 bg-amber-50/90 dark:border-[rgba(242,183,5,0.3)] dark:bg-[rgba(120,80,0,0.18)] shadow-sm flex flex-col gap-3 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SilenceRing state="silent" />
          <span className="dark-banner-warn-text font-bold text-amber-900 dark:text-[#f5d56a] text-sm">
            {t("failure.silent_clerk_title", undefined, lang)}
          </span>
        </div>
        <span className="dark-banner-warn-chip text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300/50 dark:bg-[rgba(242,183,5,0.15)] dark:text-[#f5d56a] dark:border-[rgba(242,183,5,0.3)]">
          {silenceDurationSec}s
        </span>
      </div>

      <p className="dark-banner-warn-muted text-xs text-amber-800 dark:text-[rgba(245,213,106,0.75)] leading-relaxed">
        {t("failure.silent_clerk_desc", undefined, lang)}
      </p>

      {/* Suggested Quick Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onActionClick?.("call.wait")}
          className="dark-banner-warn-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 dark:bg-[rgba(237,236,234,0.06)] dark:border-[rgba(242,183,5,0.35)] dark:text-[#f5d56a] hover:bg-amber-100/60 dark:hover:bg-[rgba(242,183,5,0.15)] transition-colors cursor-pointer"
        >
          {t("call.wait", undefined, lang)}
        </button>
        <button
          type="button"
          onClick={() => onActionClick?.("call.please_repeat")}
          className="dark-banner-warn-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 dark:bg-[rgba(237,236,234,0.06)] dark:border-[rgba(242,183,5,0.35)] dark:text-[#f5d56a] hover:bg-amber-100/60 dark:hover:bg-[rgba(242,183,5,0.15)] transition-colors cursor-pointer"
        >
          {t("call.please_repeat", undefined, lang)}
        </button>
      </div>
    </div>
  );
}
