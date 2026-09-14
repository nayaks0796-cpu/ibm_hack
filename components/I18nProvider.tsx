"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import {
  applyUiLanguage,
  getNestedMessages,
  getUiLanguage,
  subscribeUiLanguage,
} from "@/lib/i18n";
import { loadProfile } from "@/lib/store";
import type { UiLanguage } from "@/lib/types";

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<UiLanguage>(getUiLanguage);

  useEffect(() => {
    const stored = loadProfile().uiLanguage;
    setLang(applyUiLanguage(stored));
    return subscribeUiLanguage(setLang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const messages = useMemo(() => getNestedMessages(lang), [lang]);

  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
