"use client";

import { useLanguage } from "@/providers/language-provider";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-terminal-border bg-background px-4 py-3 text-center">
      <p className="text-xs text-terminal-text-muted leading-relaxed">
        {t.footer.disclaimer}
      </p>
    </footer>
  );
}
