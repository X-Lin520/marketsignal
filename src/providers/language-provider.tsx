"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Language, TranslationDict } from "@/lib/i18n/translations";
import { translations } from "@/lib/i18n/translations";

const STORAGE_KEY = "marketsignal-language";

interface LanguageContextValue {
  language: Language;
  t: TranslationDict;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  // SSR and client both start with the cookie-provided language — no mismatch
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // Persist to both localStorage and cookie so next SSR picks it up
  const persistLanguage = useCallback((lang: Language) => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.cookie = `${STORAGE_KEY}=${lang};path=/;max-age=31536000`;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") {
      // Cookie + localStorage in sync — align state if needed
      if (stored !== language) {
        setLanguageState(stored);
      }
    } else {
      // First visit: auto-detect from browser, then persist
      const browserLang = navigator.language.toLowerCase();
      const detected = browserLang.startsWith("zh") ? "zh" : "en";
      if (detected !== language) {
        setLanguageState(detected);
        persistLanguage(detected);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      persistLanguage(lang);
    },
    [persistLanguage],
  );

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === "en" ? "zh" : "en";
      persistLanguage(next);
      return next;
    });
  }, [persistLanguage]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        t: translations[language],
        setLanguage,
        toggleLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
