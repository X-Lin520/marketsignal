import type { PaperDashboard } from "@/lib/paper/service";

export function PerformanceChart({
  series,
}: {
  series: PaperDashboard["series"];
}) {
  if (!series.length)
    return <p className="paper-muted">创建账户并完成结算后展示曲线。</p>;
  const width = 800,
    height = 240,
    pad = 24;
  const numbers = series.flatMap((p) => [p.nav, p.benchmarkNav]);
  const low = Math.min(1, ...numbers) - 0.01,
    high = Math.max(1, ...numbers) + 0.01;
  const x = (i: number) =>
    pad + (i / Math.max(1, series.length - 1)) * (width - 2 * pad);
  const y = (n: number) =>
    height - pad - ((n - low) / (high - low)) * (height - 2 * pad);
  const points = (field: "nav" | "benchmarkNav") =>
    series.map((p, i) => `${x(i)},${y(p[field])}`).join(" ");
  return (
    <div>
      <div className="paper-chart-legend">
        <span className="account">● 模拟账户</span>
        <span className="benchmark">● 沪深 300 价格指数</span>
        <span>开始日净值 = 1</span>
      </div>
      <svg
        className="paper-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`账户与沪深300净值曲线，${series[0].date} 至 ${series.at(-1)!.date}，逐日数值见下方记录表`}
      >
        <title>账户净值与沪深 300 对比</title>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1={pad}
              x2={width - pad}
              y1={pad + (i * (height - 2 * pad)) / 3}
              y2={pad + (i * (height - 2 * pad)) / 3}
              stroke="currentColor"
              opacity="0.1"
            />
            <text
              x={pad}
              y={pad + (i * (height - 2 * pad)) / 3 - 5}
              fill="currentColor"
              opacity="0.5"
              fontSize="10"
            >
              {(high - (i * (high - low)) / 3).toFixed(3)}
            </text>
          </g>
        ))}
        <polyline
          points={points("benchmarkNav")}
          fill="none"
          stroke="#d6a04b"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <polyline
          points={points("nav")}
          fill="none"
          stroke="#42b89d"
          strokeWidth="3"
        />
        {series.length === 1 && (
          <circle cx={x(0)} cy={y(series[0].nav)} r="4" fill="#42b89d" />
        )}
      </svg>
      <div className="paper-chart-dates">
        <span>{series[0].date}</span>
        <span>{series.at(-1)!.date}</span>
      </div>
    </div>
  );
}
