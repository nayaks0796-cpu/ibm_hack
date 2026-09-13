import en from "@/messages/en.json";

type MessageKey = keyof typeof en;

export function t(key: MessageKey, vars?: Record<string, string>): string {
  const template: string = en[key];
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
