import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { trackOrder, type TrackedOrder } from '../lib/api/orders'
import { formatNaira } from '../lib/format'
import { Button } from '../components/ui/Button'

export function OrderConfirmation() {
  const [params] = useSearchParams()
  const location = useLocation()
  const whatsappUrl = (location.state as { whatsappUrl?: string } | null)?.whatsappUrl
  const orderNumber = params.get('order') ?? ''
  const phone = params.get('phone') ?? ''

  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderNumber || !phone) {
      setLoading(false)
      return
    }
    trackOrder(orderNumber, phone)
      .then(setOrder)
      .finally(() => setLoading(false))
  }, [orderNumber, phone])

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
        ✅
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-ink-800">Order placed!</h1>
      <p className="mt-2 text-[15px] text-ink-400">
        Order <strong>{orderNumber}</strong> is saved as awaiting payment.
      </p>

      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-6 block">
          <Button fullWidth size="lg">
            Confirm payment on WhatsApp
          </Button>
        </a>
      )}

      {!loading && order && (
        <div className="mt-6 rounded-2xl bg-white p-4 text-left ring-1 ring-ink-100">
          <div className="flex flex-col gap-1 text-[14px]">
            {order.items.map((i, idx) => (
              <div key={idx} className="flex justify-between text-ink-600">
                <span>
                  {i.item_name} ({i.variation_label}) × {i.quantity}
                </span>
                <span>{formatNaira(i.unit_price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-ink-100 pt-3 text-[15px] font-bold text-ink-800">
            <span>Total</span>
            <span>{formatNaira(order.total)}</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Link to={`/track?order=${orderNumber}&phone=${encodeURIComponent(phone)}`}>
          <Button fullWidth variant="secondary">
            Track this order
          </Button>
        </Link>
        <Link to="/">
          <Button fullWidth variant="ghost">
            Back to menu
          </Button>
        </Link>
      </div>
    </div>
  )
}
