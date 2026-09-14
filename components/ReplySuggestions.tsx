"use client";

import type { ReplySuggestion } from "@/lib/types";
import { t } from "@/lib/i18n";

export default function ReplySuggestions({
  suggestions,
  alwaysPresent,
  selectedId,
  onSelect,
}: {
  suggestions: ReplySuggestion[];
  alwaysPresent: ReplySuggestion[];
  selectedId: string | null;
  onSelect: (suggestion: ReplySuggestion) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <SuggestionRow
        heading={t("call.reply_suggestions")}
        items={suggestions}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <SuggestionRow
        heading={t("call.always_present")}
        items={alwaysPresent}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  );
}

function SuggestionRow({
  heading,
  items,
  selectedId,
  onSelect,
}: {
  heading: string;
  items: ReplySuggestion[];
  selectedId: string | null;
  onSelect: (suggestion: ReplySuggestion) => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">{heading}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`min-h-12 rounded-full border px-4 py-2.5 text-left text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                selected
                  ? "border-transparent bg-signal text-paper"
                  : "border-[var(--border)] bg-raised text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
