import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useSettings } from '../hooks/useSettings'
import { fetchDeliveryBands, fetchPickupWindows } from '../lib/api/deliveryBands'
import { placeOrder, previewDiscount } from '../lib/api/orders'
import { sendOrderEmail } from '../lib/edgeFunctions'
import { calculateDispatchFee, distanceFromShopKm } from '../lib/delivery'
import { formatNaira } from '../lib/format'
import { buildWhatsAppOrderMessage } from '../lib/whatsappOrderMessage'
import { waLink } from '../lib/whatsapp'
import { LocationPicker } from '../components/checkout/LocationPicker'
import { Button } from '../components/ui/Button'
import type { DeliveryBandRow, PickupWindowRow } from '../types/db'

type DeliveryType = 'dispatch' | 'pickup'

export function Checkout() {
  const { lines, subtotal, menuDate, clearCart } = useCart()
  const settings = useSettings()
  const navigate = useNavigate()

  const [bands, setBands] = useState<DeliveryBandRow[]>([])
  const [pickupWindows, setPickupWindows] = useState<PickupWindowRow[]>([])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('dispatch')
  const [addressText, setAddressText] = useState('')
  const [pin, setPin] = useState({ lat: settings.shop_location.lat, lng: settings.shop_location.lng })
  const [pickupWindowId, setPickupWindowId] = useState('')
  const [note, setNote] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState<{ code: string; amount: number } | null>(null)
  const [discountMessage, setDiscountMessage] = useState<string | null>(null)
  const [checkingDiscount, setCheckingDiscount] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDeliveryBands().then(setBands).catch(() => setBands([]))
    fetchPickupWindows(true).then(setPickupWindows).catch(() => setPickupWindows([]))
  }, [])

  useEffect(() => {
    setPin({ lat: settings.shop_location.lat, lng: settings.shop_location.lng })
  }, [settings.shop_location.lat, settings.shop_location.lng])

  const quote = useMemo(() => {
    if (deliveryType !== 'dispatch' || bands.length === 0) return null
    const distanceKm = distanceFromShopKm(pin.lat, pin.lng)
    return calculateDispatchFee(distanceKm, bands, settings.delivery_step, settings.max_delivery_km.km)
  }, [deliveryType, pin, bands, settings.delivery_step, settings.max_delivery_km.km])

  const discountAmount = discount?.amount ?? 0
  const dispatchFee = deliveryType === 'dispatch' ? (quote?.available ? quote.fee ?? 0 : 0) : 0
  const total = subtotal - discountAmount + dispatchFee

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-ink-800">Your cart is empty</h1>
        <Link to="/" className="mt-5">
          <Button>Browse menu</Button>
        </Link>
      </div>
    )
  }

  async function handleApplyDiscount() {
    if (!discountInput.trim()) return
    setCheckingDiscount(true)
    setDiscountMessage(null)
    try {
      const result = await previewDiscount(discountInput.trim(), subtotal)
      if (result.valid) {
        setDiscount({ code: discountInput.trim().toUpperCase(), amount: result.discount_amount ?? 0 })
        setDiscountMessage(`Code applied: -${formatNaira(result.discount_amount ?? 0)}`)
      } else {
        setDiscount(null)
        setDiscountMessage(result.reason ?? 'That code is not valid.')
      }
    } catch {
      setDiscountMessage('Could not check that code right now.')
    } finally {
      setCheckingDiscount(false)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.')
      return
    }
    if (deliveryType === 'dispatch' && !addressText.trim()) {
      setError('Please add your address and a landmark for the rider.')
      return
    }
    if (deliveryType === 'dispatch' && quote && !quote.available) {
      setError("That location is outside our delivery area — please contact us on WhatsApp instead.")
      return
    }
    if (deliveryType === 'pickup' && !pickupWindowId) {
      setError('Please choose a pickup time.')
      return
    }
    if (!menuDate) {
      setError('Your cart is missing a menu date — please start again from the menu.')
      return
    }

    setSubmitting(true)
    try {
      const result = await placeOrder({
        menuDate,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || null,
        deliveryType,
        addressText: deliveryType === 'dispatch' ? addressText.trim() : null,
        addressLat: deliveryType === 'dispatch' ? pin.lat : null,
        addressLng: deliveryType === 'dispatch' ? pin.lng : null,
        pickupWindowId: deliveryType === 'pickup' ? pickupWindowId : null,
        dispatchFeeEstimate: deliveryType === 'dispatch' ? dispatchFee : null,
        discountCode: discount?.code ?? null,
        note: note.trim() || null,
        items: lines.map((l) => ({ variationId: l.variationId, quantity: l.quantity })),
      })

      void sendOrderEmail(result.order_id, 'new_order')

      const pickupLabel = pickupWindows.find((w) => w.id === pickupWindowId)?.label ?? null
      const message = buildWhatsAppOrderMessage({
        orderNumber: result.order_number,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        lines,
        subtotal: result.subtotal,
        discountAmount: result.discount_amount,
        discountCode: discount?.code ?? null,
        deliveryType,
        dispatchFeeEstimate: deliveryType === 'dispatch' ? dispatchFee : null,
        pickupWindowLabel: pickupLabel,
        total: result.total,
        addressText: deliveryType === 'dispatch' ? addressText.trim() : null,
        addressLat: deliveryType === 'dispatch' ? pin.lat : null,
        addressLng: deliveryType === 'dispatch' ? pin.lng : null,
        menuDate,
      })

      clearCart()
      navigate(`/order-confirmation?order=${result.order_number}&phone=${encodeURIComponent(phone.trim())}`, {
        state: { whatsappUrl: waLink(message) },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong placing your order.'
      if (msg.includes('SLOTS_UNAVAILABLE')) {
        setError('One of your items just sold out. Please review your cart.')
      } else if (msg.includes('MENU_NOT_AVAILABLE')) {
        setError('This menu is no longer available. Please start a new order.')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-6">
      <h1 className="text-2xl font-semibold text-ink-800">Checkout</h1>

      <section className="mt-5 flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-400">Your details</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="min-h-12 rounded-xl border border-ink-100 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone / WhatsApp number"
          type="tel"
          className="min-h-12 rounded-xl border border-ink-100 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address (optional)"
          type="email"
          className="min-h-12 rounded-xl border border-ink-100 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
          Delivery or pickup
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setDeliveryType('dispatch')}
            className={`min-h-11 flex-1 rounded-xl text-[14px] font-semibold ${deliveryType === 'dispatch' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'}`}
          >
            Dispatch delivery
          </button>
          <button
            onClick={() => setDeliveryType('pickup')}
            className={`min-h-11 flex-1 rounded-xl text-[14px] font-semibold ${deliveryType === 'pickup' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'}`}
          >
            Shop pickup
          </button>
        </div>

        {deliveryType === 'dispatch' ? (
          <div className="mt-4 flex flex-col gap-3">
            <LocationPicker lat={pin.lat} lng={pin.lng} onChange={(lat, lng) => setPin({ lat, lng })} />
            <textarea
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              rows={2}
              placeholder="Full address and a landmark for the rider"
              className="w-full rounded-xl border border-ink-100 px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {quote && (
              <div className="rounded-xl bg-ink-50 p-3 text-[14px]">
                {quote.available ? (
                  <p>
                    Estimated distance: {quote.distanceKm.toFixed(1)} km · Dispatch fee:{' '}
                    <strong>{formatNaira(quote.fee ?? 0)}</strong>
                  </p>
                ) : (
                  <p className="text-brand-600">
                    Outside our delivery area, please contact us on WhatsApp.
                  </p>
                )}
              </div>
            )}
            <p className="text-[12px] text-ink-400">
              This dispatch fee is an estimate. The final delivery cost will be confirmed on WhatsApp
              before payment.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-xl bg-ink-50 p-3 text-[14px] text-ink-600">
              {settings.pickup_instructions.text}
            </p>
            <div className="flex flex-col gap-2">
              {pickupWindows.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setPickupWindowId(w.id)}
                  className={`min-h-11 rounded-xl border px-4 text-left text-[14px] font-medium ${pickupWindowId === w.id ? 'border-brand-500 bg-brand-50' : 'border-ink-100'}`}
                >
                  {w.label}
                </button>
              ))}
              {pickupWindows.length === 0 && (
                <p className="text-[13px] text-ink-400">No pickup times published yet — add a note below.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
          Note (optional)
        </h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Anything we should know?"
          className="w-full rounded-xl border border-ink-100 px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
          Discount code
        </h2>
        <div className="flex gap-2">
          <input
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            placeholder="Enter code"
            className="min-h-11 flex-1 rounded-xl border border-ink-100 px-4 text-[14px] uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button variant="secondary" onClick={() => void handleApplyDiscount()} disabled={checkingDiscount}>
            Apply
          </Button>
        </div>
        {discountMessage && (
          <p className={`mt-2 text-[13px] ${discount ? 'text-emerald-600' : 'text-brand-600'}`}>
            {discountMessage}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-ink-50 p-4">
        <div className="flex justify-between text-[14px] text-ink-600">
          <span>Subtotal</span>
          <span>{formatNaira(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="mt-1 flex justify-between text-[14px] text-emerald-600">
            <span>Discount</span>
            <span>-{formatNaira(discountAmount)}</span>
          </div>
        )}
        {deliveryType === 'dispatch' && (
          <div className="mt-1 flex justify-between text-[14px] text-ink-600">
            <span>Dispatch fee (estimate)</span>
            <span>{formatNaira(dispatchFee)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 text-[16px] font-bold text-ink-800">
          <span>Total</span>
          <span>{formatNaira(total)}</span>
        </div>
      </section>

      {error && <p className="mt-4 text-[14px] font-medium text-brand-600">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          <Button fullWidth size="lg" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order — ${formatNaira(total)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
