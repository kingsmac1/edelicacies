import { useEffect, useState } from 'react'
import { fetchBestSellers, fetchSalesVsExpenses, toCsv, downloadCsv, type BestSellerRow, type DailyTotals } from '../../lib/api/reports'
import { fetchManualSales, fetchOnlinePaidOrders } from '../../lib/api/records'
import { fetchExpenses } from '../../lib/api/expenses'
import { fetchCustomers } from '../../lib/api/customers'
import { formatNaira, todayLagos } from '../../lib/format'
import { SimpleBarChart } from '../../components/dashboard/SimpleBarChart'
import { Button } from '../../components/ui/Button'

export function OwnerReports() {
  const [range, setRange] = useState({ start: todayLagos().slice(0, 8) + '01', end: todayLagos() })
  const [bestSellers, setBestSellers] = useState<BestSellerRow[]>([])
  const [dailyTotals, setDailyTotals] = useState<DailyTotals[]>([])
  const [sortBy, setSortBy] = useState<'quantity' | 'amount'>('quantity')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchBestSellers(range.start, range.end), fetchSalesVsExpenses(range.start, range.end)])
      .then(([bs, dt]) => {
        setBestSellers(bs)
        setDailyTotals(dt)
      })
      .finally(() => setLoading(false))
  }, [range.start, range.end])

  const sorted = [...bestSellers].sort((a, b) => b[sortBy] - a[sortBy])

  async function exportSales() {
    const [manual, online] = await Promise.all([fetchManualSales(), fetchOnlinePaidOrders()])
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

  async function exportExpenses() {
    const expenses = await fetchExpenses()
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
      <h1 className="text-xl font-semibold text-ink-800">Reports</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="date"
          value={range.start}
          onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
          className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
        <input
          type="date"
          value={range.end}
          onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
          className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
        <Button size="md" variant="secondary" onClick={() => void exportSales()}>
          Export sales CSV
        </Button>
        <Button size="md" variant="secondary" onClick={() => void exportExpenses()}>
          Export expenses CSV
        </Button>
        <Button size="md" variant="secondary" onClick={() => void exportCustomers()}>
          Export customers CSV
        </Button>
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
            {sorted.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-400">No sales in this range.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {sorted.slice(0, 15).map((item, idx) => (
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
