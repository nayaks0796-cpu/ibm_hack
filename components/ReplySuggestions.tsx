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
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--setu-muted)]">
        {heading}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`min-h-12 rounded-full border px-4 py-2.5 text-left text-sm font-semibold ${
                selected
                  ? "border-[var(--setu-forest)] bg-[var(--setu-forest)] text-white"
                  : "border-[var(--setu-line)] bg-[var(--setu-card)] text-[var(--setu-ink)]"
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
