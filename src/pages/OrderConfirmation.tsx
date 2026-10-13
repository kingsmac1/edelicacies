import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { trackOrder, type TrackedOrder } from '../lib/api/orders'
import { formatNaira } from '../lib/format'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { LoginCodeForm } from '../components/account/LoginCodeForm'
import { claimOrder, createProfileFromSavedDetails } from '../lib/api/account'
import { loadSavedDetails } from '../lib/savedDetails'

export function OrderConfirmation() {
  const [params] = useSearchParams()
  const location = useLocation()
  const whatsappUrl = (location.state as { whatsappUrl?: string } | null)?.whatsappUrl
  const orderNumber = params.get('order') ?? ''
  const phone = params.get('phone') ?? ''

  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const { session, isOwner } = useAuth()
  const [showSignup, setShowSignup] = useState(false)
  const [signedUp, setSignedUp] = useState(false)
  const isCustomer = Boolean(session) && isOwner === false

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

      {!isCustomer && !signedUp && (
        <div className="mt-6 rounded-2xl bg-white p-4 text-left ring-1 ring-ink-100">
          <p className="text-[15px] font-semibold text-ink-800">Want to track every order in one place?</p>
          <p className="mt-1 text-[13px] text-ink-500">
            Create a free account in 20 seconds: no password, just a code we email you. Next time your details are
            ready and you can order again in one tap. Totally optional.
          </p>
          {showSignup ? (
            <div className="mt-4">
              <LoginCodeForm
                initialEmail={loadSavedDetails()?.email ?? ''}
                onSignedIn={() => {
                  void (async () => {
                    await createProfileFromSavedDetails(session?.user.id ?? '').catch(() => undefined)
                    if (orderNumber && phone) await claimOrder(orderNumber, phone).catch(() => undefined)
                    setSignedUp(true)
                  })()
                }}
              />
            </div>
          ) : (
            <Button className="mt-3" variant="secondary" onClick={() => setShowSignup(true)}>
              Create my account
            </Button>
          )}
        </div>
      )}
      {(isCustomer || signedUp) && (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-left text-[14px] text-emerald-800">
          <p className="font-semibold">✓ You're signed in.</p>
          <p className="mt-0.5">
            Your orders and details are on your account.{' '}
            <Link to="/account" className="font-semibold underline">
              View my orders
            </Link>
          </p>
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
