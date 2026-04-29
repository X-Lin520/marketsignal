"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/providers/language-provider";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
      <h2 className="text-lg font-semibold">{t.dashboard.error.title}</h2>
      <p className="mt-2 text-sm text-terminal-text-muted">
        {error.message || t.dashboard.error.default}
      </p>
      <Button variant="outline" size="sm" className="mt-6" onClick={reset}>
        {t.dashboard.error.tryAgain}
      </Button>
    </div>
  );
}
