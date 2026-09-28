import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { trackOrder, type TrackedOrder } from '../lib/api/orders'
import { formatDateLong, formatNaira } from '../lib/format'
import { Button } from '../components/ui/Button'
import type { OrderStatus } from '../types/db'

const STAGES: { status: OrderStatus; label: string }[] = [
  { status: 'awaiting_payment', label: 'Awaiting payment' },
  { status: 'paid', label: 'Paid' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'out_for_delivery', label: 'Out for delivery / Ready for pickup' },
  { status: 'delivered', label: 'Delivered' },
]

export function Track() {
  const [params] = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '')
  const [phone, setPhone] = useState(params.get('phone') ?? '')
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault()
    if (!orderNumber.trim() || !phone.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const result = await trackOrder(orderNumber.trim(), phone.trim())
      setOrder(result)
      if (!result) setError("We couldn't find an order with that number and phone number.")
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stageIndex = order
    ? order.status === 'ready_for_pickup'
      ? 3
      : order.status === 'cancelled'
        ? -1
        : STAGES.findIndex((s) => s.status === order.status)
    : -1

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-ink-800">Track your order</h1>
      <p className="mt-1 text-[14px] text-ink-400">Enter your order number and phone number.</p>

      <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-3">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order number (e.g. ED-0001)"
          className="min-h-12 rounded-xl border border-ink-100 px-4 text-[15px] uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number used at checkout"
          type="tel"
          className="min-h-12 rounded-xl border border-ink-100 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Track order'}
        </Button>
      </form>

      {error && <p className="mt-5 text-center text-[14px] text-brand-600">{error}</p>}

      {order && (
        <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <p className="text-[13px] text-ink-400">Order {order.order_number}</p>
          <p className="text-[15px] font-semibold text-ink-800">{formatDateLong(order.menu_date)}</p>

          {order.status === 'cancelled' ? (
            <p className="mt-3 rounded-xl bg-ink-50 p-3 text-[14px] font-medium text-ink-600">
              This order was cancelled.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {STAGES.map((stage, idx) => (
                <div key={stage.status} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      idx <= stageIndex ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-400'
                    }`}
                  >
                    {idx <= stageIndex ? '✓' : idx + 1}
                  </span>
                  <span className={`text-[14px] ${idx <= stageIndex ? 'font-medium text-ink-800' : 'text-ink-400'}`}>
                    {stage.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-1 border-t border-ink-100 pt-3 text-[14px]">
            {order.items.map((i, idx) => (
              <div key={idx} className="flex justify-between text-ink-600">
                <span>
                  {i.item_name} ({i.variation_label}) × {i.quantity}
                </span>
                <span>{formatNaira(i.unit_price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[15px] font-bold text-ink-800">
            <span>Total</span>
            <span>{formatNaira(order.total)}</span>
          </div>
        </div>
      )}

      {searched && !loading && !order && !error && (
        <p className="mt-5 text-center text-[14px] text-ink-400">No order found.</p>
      )}
    </div>
  )
}
