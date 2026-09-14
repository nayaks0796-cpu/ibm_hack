import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import ta from "@/messages/ta.json";
import te from "@/messages/te.json";
import kn from "@/messages/kn.json";
import ml from "@/messages/ml.json";
import mr from "@/messages/mr.json";
import bn from "@/messages/bn.json";

export type MessageKey = keyof typeof en;

const dictionaries: Record<string, Record<string, string>> = {
  en,
  hi,
  ta,
  te,
  kn,
  ml,
  mr,
  bn,
};

export function t(
  key: MessageKey,
  vars?: Record<string, string>,
  lang = "en"
): string {
  const dict = dictionaries[lang] ?? en;
  let template = dict[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

export const UI_LANGUAGES: { id: "en" | "hi" | "ta" | "te" | "kn" | "ml" | "mr" | "bn"; label: string }[] =
  [
    { id: "en", label: "English" },
    { id: "hi", label: "हिन्दी" },
    { id: "ta", label: "தமிழ்" },
    { id: "te", label: "తెలుగు" },
    { id: "kn", label: "ಕನ್ನಡ" },
    { id: "ml", label: "മലയാളം" },
    { id: "mr", label: "मराठी" },
    { id: "bn", label: "বাংলা" },
  ];
