import { createTranslator, type AbstractIntlMessages } from "next-intl";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import ta from "@/messages/ta.json";
import te from "@/messages/te.json";
import kn from "@/messages/kn.json";
import ml from "@/messages/ml.json";
import mr from "@/messages/mr.json";
import bn from "@/messages/bn.json";
import type { UiLanguage } from "./types";

export type MessageKey = keyof typeof en;

export const UI_LANGUAGE_IDS: UiLanguage[] = [
  "en",
  "hi",
  "ta",
  "te",
  "kn",
  "ml",
  "mr",
  "bn",
];

const FLAT: Record<UiLanguage, Record<string, string>> = {
  en,
  hi,
  ta,
  te,
  kn,
  ml,
  mr,
  bn,
};

function nestFlatMessages(flat: Record<string, string>): AbstractIntlMessages {
  const root: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      const existing = node[part];
      if (typeof existing !== "object" || existing === null) {
        node[part] = {};
      }
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return root as AbstractIntlMessages;
}

const NESTED: Record<UiLanguage, AbstractIntlMessages> = {
  en: nestFlatMessages(en),
  hi: nestFlatMessages(hi),
  ta: nestFlatMessages(ta),
  te: nestFlatMessages(te),
  kn: nestFlatMessages(kn),
  ml: nestFlatMessages(ml),
  mr: nestFlatMessages(mr),
  bn: nestFlatMessages(bn),
};

let currentLang: UiLanguage = "en";
const listeners = new Set<(lang: UiLanguage) => void>();
const translators = new Map<UiLanguage, (key: string, values?: Record<string, string>) => string>();

export function isUiLanguage(value: string): value is UiLanguage {
  return UI_LANGUAGE_IDS.includes(value as UiLanguage);
}

export function getUiLanguage(): UiLanguage {
  return currentLang;
}

export function getNestedMessages(lang: string): AbstractIntlMessages {
  return NESTED[isUiLanguage(lang) ? lang : "en"];
}

export function applyUiLanguage(lang: string): UiLanguage {
  const next = isUiLanguage(lang) ? lang : "en";
  if (next === currentLang) return currentLang;
  currentLang = next;
  listeners.forEach((cb) => cb(next));
  return next;
}

export function subscribeUiLanguage(cb: (lang: UiLanguage) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function translatorFor(lang: UiLanguage) {
  const cached = translators.get(lang);
  if (cached) return cached;
  const created = createTranslator({
    locale: lang,
    messages: NESTED[lang],
  });
  translators.set(lang, created);
  return created;
}

function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

/** UI strings. `lang` defaults to the language chosen in setup. Call language is separate. */
export function t(
  key: MessageKey,
  vars?: Record<string, string>,
  lang?: string
): string {
  const locale = lang && isUiLanguage(lang) ? lang : currentLang;
  try {
    const value = translatorFor(locale)(key, vars);
    if (typeof value === "string" && value.length > 0 && value !== key) return value;
  } catch {
    // Fall back to the flat dictionary if next-intl cannot resolve the key.
  }
  return interpolate(FLAT[locale][key] ?? en[key] ?? key, vars);
}

export const UI_LANGUAGES: { id: UiLanguage; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "ta", label: "தமிழ்" },
  { id: "te", label: "తెలుగు" },
  { id: "kn", label: "ಕನ್ನಡ" },
  { id: "ml", label: "മലയാളം" },
  { id: "mr", label: "मराठी" },
  { id: "bn", label: "বাংলা" },
];
