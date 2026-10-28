"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import type { Language, TranslationDict } from "@/lib/i18n/translations";
import { translations } from "@/lib/i18n/translations";

const STORAGE_KEY = "marketsignal-language";
const CHANGE_EVENT = "marketsignal-language-change";
interface LanguageContextValue {
  language: Language;
  t: TranslationDict;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}
const LanguageContext = createContext<LanguageContextValue | null>(null);

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function readLanguage(fallback: Language): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    /* 浏览器禁用存储时仍可通过 Cookie 切换语言。 */
  }
  const cookie = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${STORAGE_KEY}=`))
    ?.slice(STORAGE_KEY.length + 1);
  return cookie === "zh" || cookie === "en" ? cookie : fallback;
}

export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const getSnapshot = useCallback(
    () => readLanguage(initialLanguage),
    [initialLanguage],
  );
  const language = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => initialLanguage,
  );
  const setLanguage = useCallback((lang: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* 语言切换不依赖 localStorage 成功。 */
    }
    document.cookie = `${STORAGE_KEY}=${lang};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const toggleLanguage = useCallback(
    () => setLanguage(language === "en" ? "zh" : "en"),
    [language, setLanguage],
  );
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
  const value = useContext(LanguageContext);
  if (!value)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return value;
}
