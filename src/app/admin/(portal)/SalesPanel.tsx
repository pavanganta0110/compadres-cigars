import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import type { StockAlert } from "@/lib/domain/inventory";
import { dailySeries, summarizeSales, topProducts, type SalesLine, type SalesOrder } from "@/lib/domain/sales";

const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "What is selling": revenue windows, a 14-day chart, best sellers and low-stock alerts. Gross paid sales. */
export function SalesPanel({ orders, lines, alerts, now, days = 14 }: { orders: SalesOrder[]; lines: SalesLine[]; alerts: StockAlert[]; now: Date; days?: number }) {
  const s = summarizeSales(orders, now);
  const series = dailySeries(orders, now, days);
  const top = topProducts(lines, now, 30, 5);
  const max = Math.max(1, ...series.map((d) => d.cents));
  const topMax = Math.max(1, ...top.map((t) => t.units));
  return (
    <>
      <div className="adm-kpis">
        <div className="adm-kpi"><span>Sales today</span><strong>{formatUsd(s.today.cents)}</strong><small>{s.today.orders} {s.today.orders === 1 ? "order" : "orders"}</small></div>
        <div className="adm-kpi"><span>Last 7 days</span><strong>{formatUsd(s.days7.cents)}</strong><small>{s.days7.orders} orders</small></div>
        <div className="adm-kpi"><span>Last 30 days</span><strong>{formatUsd(s.days30.cents)}</strong><small>{s.days30.orders} orders</small></div>
        <div className="adm-kpi"><span>Average order</span><strong>{formatUsd(s.avgOrderCents)}</strong><small>last 30 days</small></div>
      </div>
      <div className="adm-split">
        <section className="adm-panel" aria-labelledby="sales-chart">
          <h3 id="sales-chart">Sales, last {days} days</h3>
          <div className="adm-bars" role="img" aria-label={`Daily sales for the last ${days} days. Total ${formatUsd(series.reduce((n, d) => n + d.cents, 0))}.`}>
            {series.map((d) => (
              <div key={d.day} className="adm-bar" title={`${shortDay(d.day)}: ${formatUsd(d.cents)} (${d.orders} orders)`}>
                <span style={{ height: `${Math.max(d.cents ? 6 : 2, Math.round((d.cents / max) * 100))}%` }} className={d.cents ? "" : "zero"} />
                <small aria-hidden="true">{new Date(`${d.day}T12:00:00Z`).getUTCDate()}</small>
              </div>
            ))}
          </div>
          <details className="adm-details"><summary>Show as a table</summary>
            <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Day</th><th>Orders</th><th>Sales</th></tr></thead><tbody>
              {[...series].reverse().map((d) => <tr key={d.day}><td>{shortDay(d.day)}</td><td>{d.orders}</td><td>{formatUsd(d.cents)}</td></tr>)}
            </tbody></table></div>
          </details>
        </section>
        <section className="adm-panel" aria-labelledby="top-sellers">
          <h3 id="top-sellers">Best sellers (30 days)</h3>
          {top.length === 0 ? <p className="adm-muted">No sales yet.</p> : (
            <ol className="adm-rank">
              {top.map((t) => (
                <li key={t.sku}><span className="adm-rank-name">{t.name}</span><span className="adm-rank-bar"><i style={{ width: `${Math.round((t.units / topMax) * 100)}%` }} /></span><span className="adm-rank-num">{t.units} sold · {formatUsd(t.cents)}</span></li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <StockAlerts alerts={alerts} />
    </>
  );
}

export function StockAlerts({ alerts }: { alerts: StockAlert[] }) {
  return (
    <section className={`adm-panel ${alerts.length ? "adm-panel-warn" : ""}`} aria-labelledby="stock-alerts">
      <h3 id="stock-alerts">Inventory alerts</h3>
      {alerts.length === 0 ? <p className="adm-muted">Every published product is above its low-stock level.</p> : (
        <ul className="adm-alerts" role="alert">
          {alerts.map((a) => (
            <li key={a.id}>
              <span className={`adm-pill ${a.state === "out" ? "warn" : "amber"}`}>{a.state === "out" ? "Out of stock" : "Low stock"}</span>
              <span>{a.name}: <strong>{a.stock}</strong> left (alert at {a.low_stock_threshold})</span>
              <Link href="/admin/products">Restock</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
