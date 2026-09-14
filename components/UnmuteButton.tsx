"use client";

import { t } from "@/lib/i18n";

export default function UnmuteButton({
  unmuted,
  onToggle,
}: {
  unmuted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`min-h-16 min-w-28 rounded-full px-5 text-base font-semibold transition-all duration-200 ${
        unmuted
          ? "bg-danger text-white"
          : "border border-[var(--border)] bg-raised text-ink hover:-translate-y-0.5"
      }`}
      aria-pressed={unmuted}
      aria-label={unmuted ? t("call.mute") : t("call.unmute")}
    >
      {unmuted ? t("call.mute") : t("call.unmute")}
    </button>
  );
}
