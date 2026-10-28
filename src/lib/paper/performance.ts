export type Valuation = {
  date: string;
  equity: string;
  benchmark: string;
  cash: string;
  marketValue: string;
  revision: number;
  missingDecision: boolean;
};

export function performance(values: Valuation[], initialCash: string) {
  let peak = Number(initialCash),
    maximumDrawdown = 0;
  const base = values[0]?.benchmark;
  return values.map((value) => {
    const equity = Number(value.equity);
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? 1 - equity / peak : 0;
    maximumDrawdown = Math.max(maximumDrawdown, drawdown);
    const cumulativeReturn = equity / Number(initialCash) - 1;
    const benchmarkReturn = base
      ? Number(value.benchmark) / Number(base) - 1
      : 0;
    return {
      ...value,
      nav: equity / Number(initialCash),
      benchmarkNav: 1 + benchmarkReturn,
      cumulativeReturn,
      benchmarkReturn,
      excessReturn: cumulativeReturn - benchmarkReturn,
      drawdown,
      maximumDrawdown,
    };
  });
}
