"use client";

import { t } from "@/lib/i18n";
import {
  SpeakButton,
  spokenFieldValue,
  type BriefMicUi,
} from "@/components/BriefMic";

export default function SpeakInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  targetId,
  speakTarget,
  speakUi,
  onToggleSpeak,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  targetId: string;
  speakTarget: string | null;
  speakUi: BriefMicUi;
  onToggleSpeak: (targetId: string) => void;
}) {
  const mine = speakTarget === targetId;
  const busy = mine && (speakUi.listening || speakUi.connecting);
  const shown = spokenFieldValue(value, speakUi, mine);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      {hint ? <p className="text-sm text-[var(--muted)]">{hint}</p> : null}
      <div className="flex items-stretch gap-2">
        <input
          required={required}
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          readOnly={busy}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-label={label}
          className="field min-w-0 flex-1"
        />
        <SpeakButton
          compact
          listening={mine && speakUi.listening}
          connecting={mine && speakUi.connecting}
          onClick={() => onToggleSpeak(targetId)}
        />
      </div>
      {mine && speakUi.listening ? (
        <p className="text-xs font-semibold text-signal">{t("start.brief_listening")}</p>
      ) : null}
      {mine && speakUi.error ? (
        <p className="text-xs font-semibold text-danger" role="status">
          {speakUi.error}
        </p>
      ) : null}
    </div>
  );
}
