"use client";

import { useLanguage } from "@/providers/language-provider";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="h-7 px-2 text-xs font-medium"
    >
      {language === "en" ? "中文" : "EN"}
    </Button>
  );
}
