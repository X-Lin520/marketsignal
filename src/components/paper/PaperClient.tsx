"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { PaperDashboard } from "@/lib/paper/service";
import { PerformanceChart } from "./PerformanceChart";

type Holdings = {
  symbol: string;
  quantity: number;
  close: string;
  value: string;
  stale: boolean;
}[];
type Evidence = {
  title: string;
  link: string;
  summary: string | null;
  sentiment: string | null;
  actionableAdvice: string | null;
  source: string;
  publishedAt: string;
  ingestedAt: string;
  analyzedAt: string | null;
  capturedAt: string;
  analysisStatus: string;
  model: string | null;
  promptVersion: string | null;
};
type Tab = "overview" | "decision" | "data" | "ledger";
type Run = (
  path: string,
  payload: unknown,
  message: string,
) => Promise<boolean>;
const moneyText = (value: string | number) =>
  Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const kindName: Record<string, string> = {
  TRADE: "调整持仓",
  HOLD: "继续持有",
  CASH: "空仓等待",
};
const statusName: Record<string, string> = {
  PENDING: "待执行",
  FILLED: "已成交",
  REJECTED: "未成交",
};
const time = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
const safeLink = (value: string) =>
  /^https?:\/\//i.test(value) ? value : undefined;

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="paper-panel">
      <div className="paper-panel-heading">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="paper-field">
      {label}
      {children}
    </label>
  );
}

export function PaperClient({
  initial,
  demo = false,
}: {
  initial: PaperDashboard;
  demo?: boolean;
}) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [through, setThrough] = useState(initial.clock.completedDate);
  const run: Run = async (path, payload, success) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/paper/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "操作失败");
      const refresh = await fetch("/api/paper/dashboard", {
        cache: "no-store",
      });
      const next = await refresh.json();
      if (!refresh.ok) throw new Error(next.error ?? "重新加载数据失败");
      setData(next);
      const details = [...(result.issues ?? []), ...(result.rejected ?? [])];
      setMessage(success + (details.length ? `；${details.join("；")}` : ""));
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "连接失败，请重试");
      return false;
    } finally {
      setBusy(false);
    }
  };
  async function logout() {
    const response = await fetch("/api/paper/session", { method: "DELETE" });
    if (response.ok) window.location.reload();
    else setError("退出失败，请重试");
  }
  const latest = data.series.at(-1);
  const holdings = (
    Array.isArray(data.holdings) ? data.holdings : []
  ) as Holdings;
  return (
    <div className="paper-app">
      {demo && (
        <p className="paper-notice">
          合成演示：行情、日历和记录均为测试数据，关闭演示服务后不保留。
        </p>
      )}
      <div className="paper-page-heading">
        <div>
          <span className="paper-eyebrow">MARKETSIGNAL / PAPER LAB</span>
          <h1>模拟投资实验</h1>
          <p>把判断变成记录，让结果接受检验。</p>
        </div>
        <div className="paper-heading-actions">
          <span className="paper-pill">单账户 · 人工决策</span>
          <button className="paper-button quiet" onClick={logout}>
            退出
          </button>
        </div>
      </div>
      <details className="paper-rules">
        <summary>实验规则与收益口径</summary>
        <p>
          仅支持白名单内的沪深主板普通 A
          股现货。北京时间收盘后锁定当日决策，下一交易日收盘价模拟成交，先卖后买；买入按
          100
          股整数倍，卖出可一次卖清零股。停牌或涨跌停均保守地不模拟成交。已执行成交不随行情修正改变。
        </p>
        <p>
          收盘数据使用未复权价格；分红、送转通过核对后的事件入账。费用采用账户设置的统一模拟费率，并非完整实际税费。初始资金固定，暂不支持出入金。沪深
          300 基准使用 000300
          价格指数，不含股息再投资；账户计入分红时存在口径差异。
        </p>
        <p>
          记录不能补写成过去的决策，已有决策不能覆盖。全球新闻和 AI
          文字仅作为人工判断的参考，不会自动产生指令。
        </p>
      </details>
      {(error || message) && (
        <div
          className={error ? "paper-notice error" : "paper-notice"}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </div>
      )}
      {!data.account ? (
        <>
          <div className="paper-notice">
            首次使用：先导入交易日历和开始日的沪深 300 收盘点位，再创建账户。CSV
            示例仅供格式参考，需替换为核实的数据。
          </div>
          <div className="paper-two-col">
            <ImportPanel run={run} busy={busy} />
            <AccountForm
              run={run}
              busy={busy}
              date={data.clock.completedDate}
            />
          </div>
        </>
      ) : (
        <>
          <nav className="paper-tabs" aria-label="实验区栏目">
            {(
              [
                ["overview", "账户概览"],
                ["decision", "每日决策"],
                ["data", "行情与日历"],
                ["ledger", "流水与导出"],
              ] as [Tab, string][]
            ).map(([id, name]) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <>
              <div className="paper-valuation-heading">
                <span>
                  最近估值：<strong>{latest?.date ?? "待结算"}</strong> ·
                  数据为收盘后记录
                </span>
                <button
                  className="paper-text-button"
                  onClick={() => setTab("data")}
                >
                  补充行情 →
                </button>
              </div>
              <div className="paper-metrics">
                {[
                  ["总资产 · 元", latest ? moneyText(latest.equity) : "—"],
                  ["可用现金 · 元", latest ? moneyText(latest.cash) : "—"],
                  [
                    "持仓市值 · 元",
                    latest ? moneyText(latest.marketValue) : "—",
                  ],
                  ["累计收益", latest ? percent(latest.cumulativeReturn) : "—"],
                  [
                    "沪深 300 同期",
                    latest ? percent(latest.benchmarkReturn) : "—",
                  ],
                  [
                    "超额收益 · 百分点",
                    latest ? (latest.excessReturn * 100).toFixed(2) : "—",
                  ],
                  ["最大回撤", latest ? percent(latest.maximumDrawdown) : "—"],
                ].map(([label, value]) => (
                  <div className="paper-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <Panel
                title="从同一天开始比较"
                subtitle="累计净值；交易费用已计入账户。"
              >
                <PerformanceChart series={data.series} />
              </Panel>
              <div className="paper-two-col">
                <Panel
                  title="当前持仓"
                  subtitle={`截至 ${latest?.date ?? "—"}；依据成交与公司行为流水计算。`}
                >
                  {holdings.length ? (
                    <div className="paper-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>标的</th>
                            <th>数量</th>
                            <th>收盘价</th>
                            <th>市值 · 元</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.map((h) => (
                            <tr key={h.symbol}>
                              <td>
                                {
                                  data.account?.instruments.find(
                                    (i) => i.symbol === h.symbol,
                                  )?.name
                                }
                                <small>
                                  {h.symbol}
                                  {h.stale && " · 停牌价格"}
                                </small>
                              </td>
                              <td>{h.quantity}</td>
                              <td>{moneyText(h.close)}</td>
                              <td>{moneyText(h.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="paper-empty">当前空仓，资金以现金持有。</p>
                  )}
                </Panel>
                <Panel
                  title="结算收盘日"
                  subtitle="只处理已确认的交易日。重复操作不会产生重复成交。"
                >
                  <form
                    className="paper-stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("settle", { through }, "结算已检查");
                    }}
                  >
                    <Field label="结算至（北京时间）">
                      <input
                        type="date"
                        required
                        min={data.account.startDate}
                        max={data.clock.completedDate}
                        value={through}
                        onChange={(e) => setThrough(e.target.value)}
                      />
                    </Field>
                    <button className="paper-button primary" disabled={busy}>
                      {busy ? "处理中…" : "结算已收盘日期"}
                    </button>
                    <p className="paper-muted">
                      已检查日历至 {data.account.settledThrough}
                      。若缺日历或行情，会停在缺失处并说明原因。
                    </p>
                  </form>
                </Panel>
              </div>
              <Panel
                title="每日绩效与留痕"
                subtitle="最大回撤从初始资金与历史高点计算；“未记录”表示当日缺少人工决策。"
              >
                <div className="paper-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>总资产 · 元</th>
                        <th>账户收益</th>
                        <th>基准收益</th>
                        <th>最大回撤</th>
                        <th>每日记录</th>
                        <th>估值版本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.series.map((s) => (
                        <tr key={s.date}>
                          <td>{s.date}</td>
                          <td>{moneyText(s.equity)}</td>
                          <td>{percent(s.cumulativeReturn)}</td>
                          <td>{percent(s.benchmarkReturn)}</td>
                          <td>{percent(s.maximumDrawdown)}</td>
                          <td>
                            {s.date === data.account?.startDate ? (
                              "开始日基线"
                            ) : s.missingDecision ? (
                              <span className="paper-warning">未记录</span>
                            ) : (
                              "已记录"
                            )}
                          </td>
                          <td>v{s.revision}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}
          {tab === "decision" && (
            <DecisionPanel data={data} run={run} busy={busy} />
          )}
          {tab === "data" && (
            <>
              <ImportPanel run={run} busy={busy} />
              <div className="paper-two-col">
                <Panel
                  title="最近行情"
                  subtitle="修正导入会新增版本并重新估值，不重定历史成交价。"
                >
                  <div className="paper-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>日期 / 标的</th>
                          <th>收盘价</th>
                          <th>状态</th>
                          <th>来源 / 版本</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.prices.map((p) => (
                          <tr key={p.date + p.symbol}>
                            <td>
                              {p.date}
                              <small>{p.symbol}</small>
                            </td>
                            <td>{p.close}</td>
                            <td>{p.status}</td>
                            <td>
                              {p.source}
                              <small>v{p.revision}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel
                  title="最近日历"
                  subtitle="需包含区间内所有日期，休市日填写 0。已导入的开休市状态锁定。"
                >
                  <div className="paper-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>交易状态</th>
                          <th>来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.calendar.map((d) => (
                          <tr key={d.date}>
                            <td>{d.date}</td>
                            <td>{d.isOpen ? "开市" : "休市"}</td>
                            <td>{d.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            </>
          )}
          {tab === "ledger" && (
            <>
              <Panel
                title="账户与数据导出"
                subtitle="完整导出包含原始决策证据、行情修订和全部估值版本。"
              >
                <div className="paper-export-row">
                  <p>
                    初始资金 {moneyText(data.account.initialCash)} 元 · 开始日{" "}
                    {data.account.startDate}
                    <br />
                    统一模拟费率 {data.account.feeBps} bps · 单笔最低费用{" "}
                    {moneyText(data.account.minimumFee)} 元
                  </p>
                  <a className="paper-button" href="/api/paper/export" download>
                    导出完整 JSON
                  </a>
                </div>
                <p className="paper-muted">
                  数据保存在服务器数据库。下载文件含实验记录，请自行妥善保存；数据库恢复按维护指南操作。
                </p>
              </Panel>
              <Panel
                title="模拟成交流水"
                subtitle="展示最近 100 笔，完整记录可导出。"
              >
                <div className="paper-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>成交日</th>
                        <th>标的</th>
                        <th>方向</th>
                        <th>数量</th>
                        <th>成交价</th>
                        <th>金额</th>
                        <th>费用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades.map((t, i) => (
                        <tr key={i}>
                          <td>{t.date}</td>
                          <td>{t.symbol}</td>
                          <td>{t.side === "BUY" ? "买入" : "卖出"}</td>
                          <td>{t.quantity}</td>
                          <td>{t.price}</td>
                          <td>{moneyText(t.gross)}</td>
                          <td>{moneyText(t.fee)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.trades.length && (
                    <p className="paper-empty">暂无已成交记录。</p>
                  )}
                </div>
              </Panel>
              <div className="paper-two-col">
                <AdjustmentForm data={data} run={run} busy={busy} />
                <Panel
                  title="分红与送转事件"
                  subtitle="人工核对权益后录入；不包含追加资金。"
                >
                  {data.adjustments.length ? (
                    data.adjustments.map((a, i) => (
                      <div className="paper-event" key={i}>
                        <strong>
                          {a.date} · {a.symbol}
                        </strong>
                        <p>
                          {a.kind === "DIVIDEND"
                            ? `现金分红 +${moneyText(a.cash)} 元`
                            : `送转 +${a.quantity} 股`}
                        </p>
                        <small>
                          {a.reason} · 来源：{a.source}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="paper-empty">暂无公司行为事件。</p>
                  )}
                </Panel>
              </div>
            </>
          )}
        </>
      )}
      <p className="paper-footer-note">
        北京时间 {time(data.clock.now)} ·
        模拟结果取决于所用数据、费用与成交假设。
      </p>
    </div>
  );
}

function AccountForm({
  run,
  busy,
  date,
}: {
  run: Run;
  busy: boolean;
  date: string;
}) {
  const [initialCash, setCash] = useState("100000.00"),
    [startDate, setDate] = useState(date),
    [feeBps, setBps] = useState("3"),
    [minimumFee, setFee] = useState("5.00"),
    [symbols, setSymbols] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const instruments = symbols
      .split(/\r?\n/)
      .filter((s) => s.trim())
      .map((line) => {
        const [symbol, ...rest] = line.split(",");
        return { symbol: symbol.trim(), name: rest.join(",").trim() };
      });
    await run(
      "account",
      {
        initialCash,
        startDate,
        feeBps: Number(feeBps),
        minimumFee,
        instruments,
      },
      "实验账户已创建",
    );
  }
  return (
    <Panel
      title="创建实验账户"
      subtitle="初始资金和费用规则创建后锁定，请先核对。"
    >
      <form className="paper-stack" onSubmit={submit}>
        <Field label="初始资金 · 元">
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={initialCash}
            onChange={(e) => setCash(e.target.value)}
          />
        </Field>
        <Field label="开始日（已收盘交易日）">
          <input
            type="date"
            required
            max={date}
            value={startDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <div className="paper-two-fields">
          <Field label="统一模拟费率 · bps">
            <input
              type="number"
              required
              min="0"
              max="500"
              step="1"
              value={feeBps}
              onChange={(e) => setBps(e.target.value)}
            />
          </Field>
          <Field label="单笔最低费用 · 元">
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={minimumFee}
              onChange={(e) => setFee(e.target.value)}
            />
          </Field>
        </div>
        <p className="paper-muted">
          1 bps = 0.01%。预填值仅为实验示例，请自行设定；不自动套用实际税费。
        </p>
        <Field label="标的白名单（每行：代码,名称，最多 10 个）">
          <textarea
            required
            rows={4}
            placeholder="600000.SH,自选标的名称"
            value={symbols}
            onChange={(e) => setSymbols(e.target.value)}
          />
        </Field>
        <p className="paper-muted">
          目前支持 60xxxx.SH / 00xxxx.SZ 沪深主板普通 A
          股；开始日账户全部为现金。
        </p>
        <button className="paper-button primary" disabled={busy}>
          {busy ? "处理中…" : "创建并锁定初始设置"}
        </button>
      </form>
    </Panel>
  );
}

function ImportPanel({ run, busy }: { run: Run; busy: boolean }) {
  const [kind, setKind] = useState("calendar"),
    [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<{
      added: number;
      unchanged: number;
      corrected: number;
      total: number;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function inspect() {
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/paper/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, csv, preview: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setPreview(body);
    } catch (error) {
      setError(error instanceof Error ? error.message : "预检失败");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Panel
      title="导入行情与交易日历"
      subtitle="先预检，再写入。数据来源必填；相同数据重复导入不会新增记录。"
    >
      <div className="paper-stack">
        <div className="paper-two-fields">
          <Field label="数据类型">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setCsv("");
                setPreview(null);
                setError("");
              }}
            >
              <option value="calendar">交易日历</option>
              <option value="prices">收盘行情（含沪深 300）</option>
            </select>
          </Field>
          <Field label="读取 CSV 文件">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1_048_576) {
                  setError("CSV 不能超过 1 MB");
                  return;
                }
                setCsv(await file.text());
                setPreview(null);
              }}
            />
          </Field>
        </div>
        <Field
          label={
            kind === "calendar"
              ? "CSV 内容：date,is_open,source"
              : "CSV 内容：date,symbol,close,status,source"
          }
        >
          <textarea
            rows={7}
            spellCheck={false}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
            }}
            placeholder={
              kind === "calendar"
                ? "date,is_open,source\nYYYY-MM-DD,1,已核实的日历来源"
                : "date,symbol,close,status,source\nYYYY-MM-DD,000300,已核实点位,OPEN,数据来源"
            }
          />
        </Field>
        <p className="paper-muted">
          日历：1 开市、0
          休市，需包含中间所有休市日。行情：仅接受已收盘日期；股票使用未复权价格。状态为
          OPEN、HALTED、LIMIT_UP 或 LIMIT_DOWN。停牌仍需提供核实的估值价格。
        </p>
        <div className="paper-actions">
          <button
            type="button"
            className="paper-button"
            disabled={busy || loading || !csv.trim()}
            onClick={inspect}
          >
            {loading ? "预检中…" : "预检数据"}
          </button>
          <button
            type="button"
            className="paper-button primary"
            disabled={busy || loading || !preview}
            onClick={async () => {
              if (
                await run("import", { kind, csv, preview: false }, "导入完成")
              )
                setPreview(null);
            }}
          >
            确认导入
          </button>
          <a href={`/paper-templates/${kind}.csv`} download>
            下载格式模板
          </a>
        </div>
        {error && (
          <p className="paper-error" role="alert">
            {error}
          </p>
        )}
        {preview && (
          <p className="paper-import-result" role="status">
            预检 {preview.total} 行：新增 {preview.added}，不变{" "}
            {preview.unchanged}，修正 {preview.corrected}。
            {preview.corrected > 0 &&
              "确认后会保存修订并重新估值，原成交保留。"}
          </p>
        )}
      </div>
    </Panel>
  );
}

function DecisionPanel({
  data,
  run,
  busy,
}: {
  data: PaperDashboard;
  run: Run;
  busy: boolean;
}) {
  const [kind, setKind] = useState("HOLD"),
    [rationale, setRationale] = useState(""),
    [newsIds, setNews] = useState<string[]>([]);
  const [orders, setOrders] = useState([
    {
      symbol: data.account?.instruments[0]?.symbol ?? "",
      side: "BUY",
      quantity: "100",
    },
  ]);
  const today = data.decisions.find((d) => d.date === data.clock.date);
  const update = (index: number, key: string, value: string) =>
    setOrders((old) =>
      old.map((o, i) => (i === index ? { ...o, [key]: value } : o)),
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(
      "decisions",
      {
        kind,
        rationale,
        newsIds,
        orders:
          kind === "TRADE"
            ? orders.map((o) => ({ ...o, quantity: Number(o.quantity) }))
            : [],
      },
      "当天决策与证据已锁定",
    );
  }
  return (
    <>
      <Panel
        title={`${data.clock.date} · 每日决策`}
        subtitle="北京时间收盘后提交；日期由服务器确定，不能回填或覆盖。"
      >
        {today ? (
          <p className="paper-import-result">
            今天已记录「{kindName[today.kind]}」，提交于{" "}
            {time(today.submittedAt)}。下方可查看锁定证据和指令状态。
          </p>
        ) : (
          <form className="paper-stack" onSubmit={submit}>
            {!data.clock.afterClose && (
              <p className="paper-warning">
                当前尚未收盘；请在北京时间 15:00 后重新进入页面记录当天决策。
              </p>
            )}
            <fieldset className="paper-choice">
              <legend>今天的动作</legend>
              {["HOLD", "CASH", "TRADE"].map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name="decision-kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {kindName[k]}
                </label>
              ))}
            </fieldset>
            {kind === "TRADE" && (
              <div className="paper-stack">
                {orders.map((o, i) => (
                  <div className="paper-order-row" key={i}>
                    <Field label={`标的 ${i + 1}`}>
                      <select
                        value={o.symbol}
                        onChange={(e) => update(i, "symbol", e.target.value)}
                      >
                        {data.account?.instruments.map((s) => (
                          <option key={s.symbol} value={s.symbol}>
                            {s.name} · {s.symbol}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="方向">
                      <select
                        value={o.side}
                        onChange={(e) => update(i, "side", e.target.value)}
                      >
                        <option value="BUY">买入</option>
                        <option value="SELL">卖出</option>
                      </select>
                    </Field>
                    <Field label="数量 · 股">
                      <input
                        required
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        value={o.quantity}
                        onChange={(e) => update(i, "quantity", e.target.value)}
                      />
                    </Field>
                    {orders.length > 1 && (
                      <button
                        type="button"
                        className="paper-text-button"
                        onClick={() =>
                          setOrders((old) => old.filter((_, n) => n !== i))
                        }
                        aria-label={`删除指令 ${i + 1}`}
                      >
                        移除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="paper-button"
                  disabled={orders.length >= 10}
                  onClick={() =>
                    setOrders((old) => [
                      ...old,
                      {
                        symbol: data.account!.instruments[0].symbol,
                        side: "BUY",
                        quantity: "100",
                      },
                    ])
                  }
                >
                  添加指令
                </button>
                <p className="paper-muted">
                  每个标的最多一条指令。按下一交易日收盘价模拟，现金或持仓不足时整笔不成交。
                </p>
              </div>
            )}
            <Field label="决策理由（10–2,000 字）">
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="记录你的依据、不确定因素，以及为何选择交易或等待。"
              />
            </Field>
            <details className="paper-evidence-picker">
              <summary>引用当时可见的新闻（可选，最多 20 条）</summary>
              {data.news.length ? (
                data.news.map((n) => (
                  <label key={n.id}>
                    <input
                      type="checkbox"
                      checked={newsIds.includes(n.id)}
                      disabled={!newsIds.includes(n.id) && newsIds.length >= 20}
                      onChange={(e) =>
                        setNews((old) =>
                          e.target.checked
                            ? [...old, n.id]
                            : old.filter((id) => id !== n.id),
                        )
                      }
                    />
                    <span>
                      {n.title}
                      <small>
                        {n.source} ·{" "}
                        {n.analysisStatus === "success"
                          ? "分析成功"
                          : "分析未确认／版本未知"}
                      </small>
                    </span>
                  </label>
                ))
              ) : (
                <p className="paper-muted">
                  当前没有可引用新闻，可直接记录独立判断。
                </p>
              )}
            </details>
            <button
              className="paper-button primary"
              disabled={busy || !data.clock.afterClose}
            >
              {busy ? "保存中…" : "锁定今天的决策与证据"}
            </button>
          </form>
        )}
      </Panel>
      <Panel
        title="决策历史"
        subtitle="展示最近 100 个交易日。原始内容与引用快照在重新分析新闻后保持可追溯。"
      >
        {!data.decisions.length && (
          <p className="paper-empty">暂无决策记录，第一次判断从今天开始。</p>
        )}
        {data.decisions.map((d) => (
          <details className="paper-decision" key={d.id}>
            <summary>
              <span>
                {d.date} · {kindName[d.kind]}
              </span>
              <small>
                {d.orders.length ? `${d.orders.length} 条指令` : "无新增指令"} ·
                已锁定
              </small>
            </summary>
            <p>{d.rationale}</p>
            <small>实际提交时间：{time(d.submittedAt)}</small>
            <DecisionContext value={d.context} />
            {d.orders.map((o) => (
              <div className="paper-event" key={o.id}>
                <strong>
                  {o.symbol} · {o.side === "BUY" ? "买入" : "卖出"} {o.quantity}{" "}
                  股
                </strong>
                <p>
                  {statusName[o.status]}
                  {o.executionDate && ` · ${o.executionDate}`}
                  {o.rejectionReason && `：${o.rejectionReason}`}
                </p>
              </div>
            ))}
            <h3>当时引用的证据副本</h3>
            {(Array.isArray(d.evidence)
              ? (d.evidence as unknown as Evidence[])
              : []
            ).map((item, i) => (
              <article className="paper-evidence" key={i}>
                <a
                  href={safeLink(item.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.title}
                </a>
                <small>
                  {item.source} · 发布 {time(item.publishedAt)} · 抓取{" "}
                  {time(item.ingestedAt)}
                </small>
                <p>
                  {item.summary ?? "当时没有可用的 AI 分析，仅保存原始新闻。"}
                </p>
                {item.actionableAdvice && (
                  <p>当时的文字洞察：{item.actionableAdvice}</p>
                )}
                <small>
                  捕获 {time(item.capturedAt)} · 分析时间{" "}
                  {item.analyzedAt ? time(item.analyzedAt) : "未完成"}
                  <br />
                  分析状态 {item.analysisStatus} · 模型 {item.model ?? "未知"} ·
                  Prompt {item.promptVersion ?? "未知"}
                </small>
              </article>
            ))}
            {Array.isArray(d.evidence) && !d.evidence.length && (
              <p className="paper-muted">未引用新闻，依据为人工填写的理由。</p>
            )}
          </details>
        ))}
      </Panel>
    </>
  );
}

function DecisionContext({ value }: { value: unknown }) {
  if (
    !value ||
    typeof value !== "object" ||
    !("cash" in value) ||
    !("equity" in value)
  )
    return null;
  const context = value as {
    cash: string;
    equity: string;
    valuationDate: string;
    valuationRevision: number;
  };
  return (
    <div className="paper-event">
      <strong>当时的账户快照</strong>
      <p>
        {context.valuationDate} · 估值 v{context.valuationRevision}
        <br />
        现金 {moneyText(context.cash)} 元 · 总资产 {moneyText(context.equity)}{" "}
        元
      </p>
      <small>之后的行情修正不会覆盖这份决策时的账户副本。</small>
    </div>
  );
}

function AdjustmentForm({
  data,
  run,
  busy,
}: {
  data: PaperDashboard;
  run: Run;
  busy: boolean;
}) {
  const [date, setDate] = useState(data.clock.completedDate),
    [symbol, setSymbol] = useState(data.account!.instruments[0].symbol),
    [kind, setKind] = useState("DIVIDEND");
  const [cash, setCash] = useState(""),
    [quantity, setQuantity] = useState(""),
    [source, setSource] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [requestId, setRequestId] = useState(() => "");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    if (
      await run(
        "adjustments",
        {
          requestId: id,
          date,
          symbol,
          kind,
          cash: kind === "DIVIDEND" ? cash : "0",
          quantity: kind === "BONUS" ? Number(quantity) : 0,
          source,
          reason,
          confirmed,
        },
        "公司行为已入账，相关估值已重新计算",
      )
    ) {
      setRequestId("");
      setCash("");
      setQuantity("");
      setReason("");
      setConfirmed(false);
    }
  }
  return (
    <Panel
      title="记录分红或送转"
      subtitle="填写本账户实际应得的净现金或新增股数，系统不自动核验权益登记。记录提交后锁定。"
    >
      <form className="paper-stack" onSubmit={submit}>
        <Field label="生效日期">
          <input
            type="date"
            required
            min={data.account!.startDate}
            max={data.clock.completedDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="标的">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {data.account!.instruments.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.name} · {i.symbol}
              </option>
            ))}
          </select>
        </Field>
        <Field label="事件类型">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="DIVIDEND">现金分红（账户应得净额）</option>
            <option value="BONUS">送股或转增（新增股数）</option>
          </select>
        </Field>
        {kind === "DIVIDEND" ? (
          <Field label="增加现金 · 元">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="新增股数">
            <input
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
        )}
        <Field label="核对来源">
          <input
            required
            minLength={2}
            maxLength={200}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </Field>
        <Field label="权益核对说明（至少 10 字）">
          <textarea
            required
            minLength={10}
            maxLength={1000}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <label className="paper-checkbox">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          已核对本账户权益，确认这不是追加资金。
        </label>
        <button className="paper-button" disabled={busy || !confirmed}>
          确认事件入账
        </button>
      </form>
    </Panel>
  );
}
