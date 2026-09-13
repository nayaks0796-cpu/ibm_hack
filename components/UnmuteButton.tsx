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
      className={`min-h-14 min-w-28 rounded-2xl border px-5 text-base font-semibold ${
        unmuted
          ? "border-red-700 bg-red-700 text-white"
          : "border-[var(--setu-line)] bg-[var(--setu-card)] text-[var(--setu-ink)]"
      }`}
      aria-pressed={unmuted}
      aria-label={unmuted ? t("call.mute") : t("call.unmute")}
    >
      {unmuted ? t("call.mute") : t("call.unmute")}
    </button>
  );
}
