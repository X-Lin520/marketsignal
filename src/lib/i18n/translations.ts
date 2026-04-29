export type Language = "en" | "zh";

export const translations = {
  en: {
    header: {
      title: "MarketSignal",
    },
    footer: {
      disclaimer:
        "The AI-generated analyses on this dashboard are for informational purposes only and do not constitute financial advice (NFA). Past performance is not indicative of future results. Always conduct your own research before making investment decisions.",
    },
    dashboard: {
      stats: {
        total: "Total",
        bullish: "Bullish",
        bearish: "Bearish",
        neutral: "Neutral",
        updated: "Updated",
      },
      filter: {
        allSources: "All Sources",
        allSectors: "All Sectors",
        clear: "Clear",
      },
      timeline: {
        loadMore: "Load More",
        remaining: "remaining",
        loading: "Loading...",
        noNews: "No news matching filters",
        noNewsHint: "Try adjusting your filters or check back later.",
        failedToLoad: "Failed to load news",
        retry: "Retry",
        processing: "Processing...",
      },
      detail: {
        aiSentiment: "AI Sentiment Assessment",
        aiSummary: "AI Summary",
        impactSectors: "Impact Sectors",
        investmentInsight: "Investment Insight",
        noSectors: "No specific sectors identified.",
        noAdvice: "No specific trading recommendation for this news item.",
        noAction: "No specific action recommended.",
        analyzed: "Analyzed",
        original: "Original",
        analysisPending: "Analysis pending — this item will be processed shortly.",
        disclaimer:
          "AI-generated analysis is for informational purposes only and does not constitute financial advice (NFA).",
      },
      error: {
        title: "Something went wrong",
        default: "An unexpected error occurred loading the dashboard.",
        tryAgain: "Try Again",
      },
    },
    metadata: {
      title: "MarketSignal — AI-Powered Market Intelligence",
      description:
        "24/7 automated financial news monitoring with AI-driven sentiment analysis, summarization, and actionable investment insights.",
    },
  },

  zh: {
    header: {
      title: "MarketSignal",
    },
    footer: {
      disclaimer:
        "本仪表盘上的 AI 生成分析仅供参考，不构成任何投资建议（NFA）。过往表现不代表未来结果。在做出投资决策前，请务必自行研究。",
    },
    dashboard: {
      stats: {
        total: "总计",
        bullish: "利好",
        bearish: "利空",
        neutral: "中性",
        updated: "更新于",
      },
      filter: {
        allSources: "全部来源",
        allSectors: "全部板块",
        clear: "清除",
      },
      timeline: {
        loadMore: "加载更多",
        remaining: "剩余",
        loading: "加载中...",
        noNews: "没有匹配的新闻",
        noNewsHint: "请调整筛选条件或稍后再来。",
        failedToLoad: "加载新闻失败",
        retry: "重试",
        processing: "分析中...",
      },
      detail: {
        aiSentiment: "AI 情绪评估",
        aiSummary: "AI 摘要",
        impactSectors: "影响板块",
        investmentInsight: "投资洞察",
        noSectors: "未识别出具体受影响板块。",
        noAdvice: "此新闻暂无具体交易建议。",
        noAction: "暂无具体操作建议。",
        analyzed: "分析时间",
        original: "原文",
        analysisPending: "分析待处理 — 该条目将很快被处理。",
        disclaimer:
          "AI 生成的分析仅供参考，不构成任何投资建议（NFA）。",
      },
      error: {
        title: "出了点问题",
        default: "加载仪表盘时发生意外错误。",
        tryAgain: "重试",
      },
    },
    metadata: {
      title: "MarketSignal — AI 驱动的市场情报",
      description:
        "24 小时自动财经新闻监控，AI 驱动的情绪分析、摘要与可操作投资洞察。",
    },
  },
} as const;

export type TranslationDict = {
  header: { title: string };
  footer: { disclaimer: string };
  dashboard: {
    stats: { total: string; bullish: string; bearish: string; neutral: string; updated: string };
    filter: { allSources: string; allSectors: string; clear: string };
    timeline: {
      loadMore: string; remaining: string; loading: string;
      noNews: string; noNewsHint: string; failedToLoad: string;
      retry: string; processing: string;
    };
    detail: {
      aiSentiment: string; aiSummary: string; impactSectors: string;
      investmentInsight: string; noSectors: string; noAdvice: string;
      noAction: string; analyzed: string; original: string;
      analysisPending: string; disclaimer: string;
    };
    error: { title: string; default: string; tryAgain: string };
  };
  metadata: { title: string; description: string };
};
