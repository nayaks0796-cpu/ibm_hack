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
      className="w-full max-w-md p-4 rounded-2xl border border-amber-200 bg-amber-50/90 shadow-sm flex flex-col gap-3 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SilenceRing state="silent" />
          <span className="font-bold text-amber-900 text-sm">
            {t("failure.silent_clerk_title", undefined, lang)}
          </span>
        </div>
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300/50">
          {silenceDurationSec}s
        </span>
      </div>

      <p className="text-xs text-amber-800 leading-relaxed">
        {t("failure.silent_clerk_desc", undefined, lang)}
      </p>

      {/* Suggested Quick Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onActionClick?.("call.wait")}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 transition-colors cursor-pointer"
        >
          {t("call.wait", undefined, lang)}
        </button>
        <button
          type="button"
          onClick={() => onActionClick?.("call.please_repeat")}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 transition-colors cursor-pointer"
        >
          {t("call.please_repeat", undefined, lang)}
        </button>
      </div>
    </div>
  );
}
