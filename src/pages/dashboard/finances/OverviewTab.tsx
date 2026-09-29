import { useEffect, useMemo, useState } from 'react'
import { fetchManualSales, fetchOnlinePaidOrders } from '../../../lib/api/records'
import { fetchExpenses } from '../../../lib/api/expenses'
import { fetchCustomers } from '../../../lib/api/customers'
import {
  fetchBestSellers,
  fetchSalesVsExpenses,
  toCsv,
  downloadCsv,
  type BestSellerRow,
  type DailyTotals,
} from '../../../lib/api/reports'
import { defaultRangeValue, resolveRange, type RangeValue } from '../../../lib/dateRange'
import { RangeFilter } from '../../../components/dashboard/RangeFilter'
import { formatNaira } from '../../../lib/format'
import { SimpleBarChart } from '../../../components/dashboard/SimpleBarChart'
import { Button } from '../../../components/ui/Button'
import type { ExpenseRow, ManualSaleRow, OrderRow } from '../../../types/db'

export function OverviewTab() {
  const [range, setRange] = useState<RangeValue>(defaultRangeValue)
  const [manual, setManual] = useState<ManualSaleRow[]>([])
  const [online, setOnline] = useState<OrderRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [bestSellers, setBestSellers] = useState<BestSellerRow[]>([])
  const [dailyTotals, setDailyTotals] = useState<DailyTotals[]>([])
  const [sortBy, setSortBy] = useState<'quantity' | 'amount'>('quantity')
  const [loading, setLoading] = useState(true)

  const resolved = resolveRange(range)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchManualSales(),
      fetchOnlinePaidOrders(),
      fetchExpenses(),
      fetchBestSellers(resolved.start, resolved.end),
      fetchSalesVsExpenses(resolved.start, resolved.end),
    ])
      .then(([m, o, e, bs, dt]) => {
        setManual(m)
        setOnline(o)
        setExpenses(e)
        setBestSellers(bs)
        setDailyTotals(dt)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.start, resolved.end])

  const manualInRange = useMemo(
    () => manual.filter((m) => m.sale_date >= resolved.start && m.sale_date <= resolved.end),
    [manual, resolved.start, resolved.end],
  )
  const onlineInRange = useMemo(
    () => online.filter((o) => o.menu_date >= resolved.start && o.menu_date <= resolved.end),
    [online, resolved.start, resolved.end],
  )
  const expensesInRange = useMemo(
    () => expenses.filter((e) => e.expense_date >= resolved.start && e.expense_date <= resolved.end),
    [expenses, resolved.start, resolved.end],
  )

  const kpis = useMemo(() => {
    const onlineRevenue = onlineInRange.reduce((sum, o) => sum + o.total, 0)
    const manualRevenue = manualInRange.reduce((sum, m) => sum + m.amount + m.delivery_fee, 0)
    const totalRevenue = onlineRevenue + manualRevenue
    const unpaid = manualInRange.filter((m) => !m.paid).reduce((sum, m) => sum + m.amount + m.delivery_fee, 0)
    const dispatchFees =
      onlineInRange.reduce((sum, o) => sum + (o.dispatch_fee_final ?? o.dispatch_fee_estimate ?? 0), 0) +
      manualInRange.reduce((sum, m) => sum + m.delivery_fee, 0)
    const totalExpenses = expensesInRange.reduce((sum, e) => sum + e.amount, 0)
    const netProfit = totalRevenue - totalExpenses
    const salesCount = manualInRange.length + onlineInRange.length
    return { onlineRevenue, manualRevenue, totalRevenue, unpaid, dispatchFees, totalExpenses, netProfit, salesCount }
  }, [manualInRange, onlineInRange, expensesInRange])

  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const e of expensesInRange) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
    const total = [...byCategory.values()].reduce((a, b) => a + b, 0)
    return [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
  }, [expensesInRange])

  const sortedBestSellers = [...bestSellers].sort((a, b) => b[sortBy] - a[sortBy])

  async function exportSales() {
    const rows = [
      ...manual.map((m) => ({
        date: m.sale_date,
        source: 'manual',
        customer: m.customer_name ?? '',
        amount: m.amount,
        delivery_fee: m.delivery_fee,
        paid: m.paid ? 'yes' : 'no',
      })),
      ...online.map((o) => ({
        date: o.menu_date,
        source: 'online',
        customer: o.customer_name,
        amount: o.total,
        delivery_fee: o.dispatch_fee_final ?? o.dispatch_fee_estimate ?? 0,
        paid: 'yes',
      })),
    ]
    downloadCsv(
      'sales.csv',
      toCsv(rows, [
        { key: 'date', label: 'Date' },
        { key: 'source', label: 'Source' },
        { key: 'customer', label: 'Customer' },
        { key: 'amount', label: 'Amount' },
        { key: 'delivery_fee', label: 'Delivery Fee' },
        { key: 'paid', label: 'Paid' },
      ]),
    )
  }

  function exportExpenses() {
    downloadCsv(
      'expenses.csv',
      toCsv(
        expenses.map((e) => ({ date: e.expense_date, category: e.category, amount: e.amount, note: e.note ?? '' })),
        [
          { key: 'date', label: 'Date' },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount' },
          { key: 'note', label: 'Note' },
        ],
      ),
    )
  }

  async function exportCustomers() {
    const customers = await fetchCustomers()
    downloadCsv(
      'customers.csv',
      toCsv(
        customers.map((c) => ({
          name: c.name ?? '',
          phone: c.phone,
          orders: c.orders_count,
          total_spent: c.total_spent,
          last_order: c.last_order_at.slice(0, 10),
        })),
        [
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'orders', label: 'Orders' },
          { key: 'total_spent', label: 'Total Spent' },
          { key: 'last_order', label: 'Last Order' },
        ],
      ),
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RangeFilter value={range} onChange={setRange} />
        <div className="flex flex-wrap gap-2">
          <Button size="md" variant="secondary" onClick={() => void exportSales()}>
            Export sales CSV
          </Button>
          <Button size="md" variant="secondary" onClick={exportExpenses}>
            Export expenses CSV
          </Button>
          <Button size="md" variant="secondary" onClick={() => void exportCustomers()}>
            Export customers CSV
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Total revenue', formatNaira(kpis.totalRevenue)],
          ['Online sales', formatNaira(kpis.onlineRevenue)],
          ['Manual sales', formatNaira(kpis.manualRevenue)],
          ['Expenses', formatNaira(kpis.totalExpenses)],
          ['Net profit', formatNaira(kpis.netProfit)],
          ['Unpaid (manual)', formatNaira(kpis.unpaid)],
          ['Dispatch fees', formatNaira(kpis.dispatchFees)],
          ['Sales count', kpis.salesCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-3 text-center ring-1 ring-ink-100">
            <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
            <p
              className={`mt-1 text-[15px] font-bold ${
                label === 'Net profit' ? (kpis.netProfit < 0 ? 'text-brand-600' : 'text-emerald-600') : 'text-ink-800'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : (
        <>
          <section className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
            <h2 className="text-[15px] font-semibold text-ink-800">Sales vs expenses</h2>
            {dailyTotals.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-400">No data in this range.</p>
            ) : (
              <div className="mt-3">
                <SimpleBarChart
                  categories={dailyTotals.map((d) => d.date)}
                  series={[
                    { label: 'Sales', color: '#ff002c', values: dailyTotals.map((d) => d.sales) },
                    { label: 'Expenses', color: '#c5c5ca', values: dailyTotals.map((d) => d.expenses) },
                  ]}
                />
              </div>
            )}
          </section>

          <section className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
            <h2 className="text-[15px] font-semibold text-ink-800">Expenses by category</h2>
            {categoryBreakdown.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-400">No expenses in this range.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {categoryBreakdown.map((c) => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-ink-700">{c.category}</span>
                      <span className="text-ink-500">{formatNaira(c.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-50">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink-800">Best sellers</h2>
              <div className="flex gap-1 text-[12px]">
                <button
                  onClick={() => setSortBy('quantity')}
                  className={`rounded-full px-2.5 py-1 font-semibold ${sortBy === 'quantity' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'}`}
                >
                  By quantity
                </button>
                <button
                  onClick={() => setSortBy('amount')}
                  className={`rounded-full px-2.5 py-1 font-semibold ${sortBy === 'amount' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'}`}
                >
                  By amount
                </button>
              </div>
            </div>
            {sortedBestSellers.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-400">No sales in this range.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {sortedBestSellers.slice(0, 15).map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-[14px]">
                    <span className="text-ink-700">
                      {idx + 1}. {item.name}
                    </span>
                    <span className="text-ink-500">
                      {item.quantity} sold · {formatNaira(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
