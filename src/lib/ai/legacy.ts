import type { Prisma } from "@prisma/client";

// 旧版本把失败占位写为中性并标记为已分析，仅在展示时纠正，不修改历史数据。
export function isLegacyPlaceholder(summary: string | null): boolean {
  return summary === "Unable to analyze this article." || Boolean(summary?.startsWith("[Pending analysis]"));
}

export const validAnalysisFilter: Prisma.NewsItemWhereInput = {
  AND: [
    { summary: { not: null } },
    { NOT: { summary: "Unable to analyze this article." } },
    { NOT: { summary: { startsWith: "[Pending analysis]" } } },
  ],
};
