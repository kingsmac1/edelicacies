import { useEffect, useState } from 'react'
import { fetchOrderItems, fetchOrders, setOrderStatus } from '../../lib/api/orders'
import { sendOrderEmail } from '../../lib/edgeFunctions'
import { formatDateLong, formatNaira } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import type { OrderItemRow, OrderRow, OrderStatus } from '../../types/db'

const STATUS_FLOW: OrderStatus[] = [
  'awaiting_payment',
  'paid',
  'preparing',
  'out_for_delivery',
  'delivered',
]

const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function nextStatus(order: OrderRow): OrderStatus | null {
  if (order.status === 'cancelled' || order.status === 'delivered') return null
  if (order.status === 'paid') {
    return order.delivery_type === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery'
  }
  if (order.status === 'ready_for_pickup') return 'delivered'
  const idx = STATUS_FLOW.indexOf(order.status)
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
}

export function OwnerOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, OrderItemRow[]>>({})
  const [feeDraft, setFeeDraft] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setOrders(await fetchOrders())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggleExpand(order: OrderRow) {
    if (expandedId === order.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(order.id)
    if (!items[order.id]) {
      const rows = await fetchOrderItems(order.id)
      setItems((prev) => ({ ...prev, [order.id]: rows }))
    }
  }

  async function handleAdvance(order: OrderRow) {
    const next = nextStatus(order)
    if (!next) return
    setBusyId(order.id)
    try {
      const finalFee =
        next === 'paid' && order.delivery_type === 'dispatch' && feeDraft[order.id]
          ? Number(feeDraft[order.id])
          : undefined
      await setOrderStatus(order.id, next, finalFee)
      void sendOrderEmail(order.id, 'stage_change')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(order: OrderRow) {
    setBusyId(order.id)
    try {
      await setOrderStatus(order.id, 'cancelled')
      void sendOrderEmail(order.id, 'stage_change')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const filtered = orders.filter((o) => statusFilter === 'all' || o.status === statusFilter)

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Orders</h1>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {(['all', ...STATUS_FLOW, 'ready_for_pickup', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${
              statusFilter === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">No orders here yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {filtered.map((order) => {
            const next = nextStatus(order)
            const expanded = expandedId === order.id
            return (
              <div key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
                <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => void toggleExpand(order)}>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink-800">
                      {order.order_number} · {order.customer_name}
                    </p>
                    <p className="text-[13px] text-ink-400">
                      {order.customer_phone} · {formatDateLong(order.menu_date)} ·{' '}
                      {order.delivery_type === 'dispatch' ? 'Dispatch' : 'Pickup'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-bold text-brand-600">{formatNaira(order.total)}</p>
                    <span className="text-[12px] font-semibold text-ink-500">{STATUS_LABELS[order.status]}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="mt-3 border-t border-ink-100 pt-3">
                    <div className="flex flex-col gap-1 text-[14px]">
                      {(items[order.id] ?? []).map((i) => (
                        <div key={i.id} className="flex justify-between text-ink-600">
                          <span>
                            {i.item_name} ({i.variation_label}) × {i.quantity}
                          </span>
                          <span>{formatNaira(i.unit_price * i.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    {order.note && <p className="mt-2 text-[13px] italic text-ink-500">Note: {order.note}</p>}
                    {order.delivery_type === 'dispatch' && order.address_text && (
                      <p className="mt-2 text-[13px] text-ink-500">
                        {order.address_text}
                        {order.address_lat != null && (
                          <>
                            {' · '}
                            <a
                              className="text-brand-600"
                              href={`https://maps.google.com/?q=${order.address_lat},${order.address_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Map
                            </a>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                    {order.status === 'awaiting_payment' && order.delivery_type === 'dispatch' && (
                      <input
                        type="number"
                        placeholder={`Final fee (est. ${formatNaira(order.dispatch_fee_estimate ?? 0)})`}
                        value={feeDraft[order.id] ?? ''}
                        onChange={(e) => setFeeDraft((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        className="min-h-9 w-44 rounded-lg border border-ink-100 px-2 text-[13px]"
                      />
                    )}
                    {next && (
                      <Button size="md" onClick={() => void handleAdvance(order)} disabled={busyId === order.id}>
                        Mark {STATUS_LABELS[next]}
                      </Button>
                    )}
                    <Button
                      size="md"
                      variant="ghost"
                      onClick={() => void handleCancel(order)}
                      disabled={busyId === order.id}
                    >
                      Cancel order
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
