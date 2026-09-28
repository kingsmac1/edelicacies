import { useEffect, useState } from 'react'
import { fetchCustomers } from '../../lib/api/customers'
import { formatDateShort, formatNaira } from '../../lib/format'
import type { CustomerRow } from '../../types/db'

export function OwnerCustomers() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [repeatOnly, setRepeatOnly] = useState(false)

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .finally(() => setLoading(false))
  }, [])

  const shown = repeatOnly ? customers.filter((c) => c.orders_count > 1) : customers

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-800">Customers</h1>
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-600">
          <input
            type="checkbox"
            checked={repeatOnly}
            onChange={(e) => setRepeatOnly(e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          Repeat customers only
        </label>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">No customers yet.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl bg-white ring-1 ring-ink-100">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr className="border-b border-ink-100 text-left text-[12px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Total spent</th>
                <th className="px-4 py-3">Last order</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-800">{c.name || 'Unnamed'}</p>
                    <p className="text-[12px] text-ink-400">{c.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{c.orders_count}</td>
                  <td className="px-4 py-3 font-semibold text-brand-600">{formatNaira(c.total_spent)}</td>
                  <td className="px-4 py-3 text-ink-500">{formatDateShort(c.last_order_at.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
