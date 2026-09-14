"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

export interface NumberCapturedBannerProps {
  /** The reference or complaint number detected in live captions */
  referenceNumber: string;
  /** Callback fired when user confirms pinning the reference number */
  onConfirmPin?: (ref: string) => void;
  /** Callback fired when user dismisses the prompt */
  onDismiss?: () => void;
  /** UI language code */
  lang?: string;
}

export default function NumberCapturedBanner({
  referenceNumber,
  onConfirmPin,
  onDismiss,
  lang = "en",
}: NumberCapturedBannerProps) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(false);
  }, [referenceNumber]);

  if (!referenceNumber) return null;

  const handleConfirm = () => {
    setPinned(true);
    if (onConfirmPin) {
      onConfirmPin(referenceNumber);
    }
  };

  return (
    <div
      role="region"
      aria-label="Reference number prompt"
      className={`flex w-full flex-col gap-3 rounded-[1.75rem] px-4 py-3 shadow-card transition-all ${
        pinned ? "bg-signal text-paper" : "bg-ink text-paper"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold">
          {t("call.pin_prompt", { ref: referenceNumber }, lang)}
        </p>
        <span className="rounded-full bg-paper px-3 py-1 font-mono text-sm font-bold text-ink">
          {referenceNumber}
        </span>
      </div>

      {!pinned ? (
        <div className="flex items-center justify-end gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-11 rounded-full border border-white/25 px-4 text-sm font-semibold"
            >
              {t("call.pin_dismiss", undefined, lang)}
            </button>
          )}
          <button type="button" onClick={handleConfirm} className="gold-btn min-h-11">
            {t("call.pin_confirm", undefined, lang)}
          </button>
        </div>
      ) : (
        <p className="text-sm font-semibold">{t("call.pin_pinned", { ref: referenceNumber }, lang)}</p>
      )}
    </div>
  );
}
