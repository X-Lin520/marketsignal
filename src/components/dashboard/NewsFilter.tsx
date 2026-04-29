"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FINANCE_SECTORS } from "@/lib/utils/constants";
import { useLanguage } from "@/providers/language-provider";
import { X } from "lucide-react";

interface NewsFilterProps {
  sources: string[];
}

export function NewsFilter({ sources }: NewsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const selectedSentiment = searchParams.get("sentiment") ?? "all";
  const selectedSource = searchParams.get("source") ?? "all";
  const selectedSector = searchParams.get("sector") ?? "all";

  const hasFilters =
    selectedSentiment !== "all" ||
    selectedSource !== "all" ||
    selectedSector !== "all";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const clearAll = useCallback(() => {
    router.push("/", { scroll: false });
  }, [router]);

  return (
    <nav aria-label="News filters" className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        value={selectedSentiment === "all" ? [] : [selectedSentiment]}
        onValueChange={(vals) => updateParam("sentiment", vals[0] ?? "all")}
        className="flex-wrap"
      >
        <ToggleGroupItem value="Bullish" size="sm" aria-label="Bullish only" className="text-bullish data-[pressed]:bg-bullish-muted data-[pressed]:text-bullish">
          {t.dashboard.stats.bullish}
        </ToggleGroupItem>
        <ToggleGroupItem value="Bearish" size="sm" aria-label="Bearish only" className="text-bearish data-[pressed]:bg-bearish-muted data-[pressed]:text-bearish">
          {t.dashboard.stats.bearish}
        </ToggleGroupItem>
        <ToggleGroupItem value="Neutral" size="sm" aria-label="Neutral only" className="text-neutral-sentiment data-[pressed]:bg-neutral-sentiment-muted data-[pressed]:text-neutral-sentiment">
          {t.dashboard.stats.neutral}
        </ToggleGroupItem>
      </ToggleGroup>

      <Select
        value={selectedSource}
        onValueChange={(val) => updateParam("source", val ?? "all")}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder={t.dashboard.filter.allSources} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.dashboard.filter.allSources}</SelectItem>
          {sources.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedSector}
        onValueChange={(val) => updateParam("sector", val ?? "all")}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder={t.dashboard.filter.allSectors} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.dashboard.filter.allSectors}</SelectItem>
          {FINANCE_SECTORS.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-8 text-xs text-terminal-text-muted"
        >
          <X className="mr-1 h-3 w-3" />
          {t.dashboard.filter.clear}
        </Button>
      )}
    </nav>
  );
}
