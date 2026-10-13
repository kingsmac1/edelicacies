import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { usePublicDailyMenu } from '../hooks/usePublicDailyMenu'
import {
  createProfileFromSavedDetails,
  deleteAddress,
  deleteMyAccountData,
  fetchAddresses,
  fetchMyOrders,
  fetchProfile,
  makeDefaultAddress,
  renameAddress,
  saveProfile,
  type AddressRow,
  type MyOrder,
} from '../lib/api/account'
import { clearSavedDetails } from '../lib/savedDetails'
import { formatDateLong, formatNaira } from '../lib/format'
import { Button } from '../components/ui/Button'
import { LoginCodeForm } from '../components/account/LoginCodeForm'

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Waiting for approval',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_STYLE: Record<string, string> = {
  pending_approval: 'bg-amber-50 text-amber-700',
  awaiting_payment: 'bg-amber-50 text-amber-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-ink-100 text-ink-500',
}

export function Account() {
  const { session, loading, isOwner, signOut } = useAuth()
  const [tab, setTab] = useState<'orders' | 'details'>('orders')

  if (loading) return <div className="px-4 py-24 text-center text-ink-400">Loading…</div>

  if (!session) {
    return (
      <div className="mx-auto max-w-sm px-4 py-14">
        <h1 className="text-2xl font-semibold text-ink-800">Your Edelicacies account</h1>
        <p className="mt-2 text-[14px] text-ink-400">
          Sign in to see your orders, track them, and order again in one tap. New here? Just enter your email and
          we'll create your account.
        </p>
        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
          <LoginCodeForm />
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-400">
          You can always order without an account.{' '}
          <Link to="/" className="font-semibold text-brand-600">
            Back to the menu
          </Link>
        </p>
      </div>
    )
  }

  if (isOwner === null) return <div className="px-4 py-24 text-center text-ink-400">Loading…</div>

  if (isOwner) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-ink-800">You're signed in as the owner</h1>
        <p className="mt-2 text-[14px] text-ink-400">The customer account area is for customers.</p>
        <Link to="/dashboard" className="mt-5 block">
          <Button fullWidth>Open the dashboard</Button>
        </Link>
      </div>
    )
  }

  return (
    <CustomerArea
      userId={session.user.id}
      email={session.user.email ?? ''}
      tab={tab}
      setTab={setTab}
      onSignOut={() => void signOut()}
    />
  )
}

function CustomerArea({
  userId,
  email,
  tab,
  setTab,
  onSignOut,
}: {
  userId: string
  email: string
  tab: 'orders' | 'details'
  setTab: (t: 'orders' | 'details') => void
  onSignOut: () => void
}) {
  const [orders, setOrders] = useState<MyOrder[]>([])
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      // First visit after signing up: turn what they typed at checkout into a profile.
      await createProfileFromSavedDetails(userId).catch(() => undefined)
      const [profile, addr, myOrders] = await Promise.all([
        fetchProfile(userId),
        fetchAddresses(),
        fetchMyOrders(),
      ])
      setName(profile?.name ?? '')
      setPhone(profile?.phone ?? '')
      setAddresses(addr)
      setOrders(myOrders)
      setError(null)
    } catch {
      setError('We could not load your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      await saveProfile(userId, { name, phone })
      setNotice('Saved.')
    } catch {
      setError('Could not save your details.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMyData() {
    if (!window.confirm('Delete your saved name, phone and addresses? Your past orders stay with the shop.')) return
    try {
      await deleteMyAccountData()
      clearSavedDetails()
      setName('')
      setPhone('')
      setAddresses([])
      setNotice('Your saved details were deleted.')
    } catch {
      setError('Could not delete your details. Please try again.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-800">
            {name ? `Hi, ${name.split(' ')[0]}` : 'Your account'}
          </h1>
          <p className="text-[13px] text-ink-400">{email}</p>
        </div>
        <button onClick={onSignOut} className="min-h-10 rounded-full px-4 text-[13px] font-semibold text-ink-600 ring-1 ring-ink-100">
          Sign out
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        {(
          [
            ['orders', 'My orders'],
            ['details', 'My details'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`min-h-11 rounded-full px-5 text-[14px] font-semibold ${
              tab === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-[14px] font-medium text-brand-600">{error}</p>}
      {notice && <p className="mt-4 text-[14px] font-medium text-emerald-600">{notice}</p>}

      {loading ? (
        <p className="mt-10 text-center text-[14px] text-ink-400">Loading…</p>
      ) : tab === 'orders' ? (
        <OrdersList orders={orders} />
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
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
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save details'}
            </Button>
          </form>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-400">Saved addresses</h2>
            {addresses.length === 0 ? (
              <p className="mt-3 text-[14px] text-ink-400">
                No saved addresses yet. We save the address you use at checkout, with its map pin, so your delivery
                fee is right next time.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {addresses.map((a) => (
                  <AddressCard
                    key={a.id}
                    address={a}
                    onChanged={async () => setAddresses(await fetchAddresses())}
                  />
                ))}
              </div>
            )}
          </div>

          <button onClick={() => void handleDeleteMyData()} className="self-start text-[13px] font-medium text-ink-400 underline">
            Delete my saved details
          </button>
        </div>
      )}
    </div>
  )
}

function AddressCard({ address, onChanged }: { address: AddressRow; onChanged: () => Promise<void> }) {
  const [label, setLabel] = useState(address.label)
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== address.label && void renameAddress(address.id, label).then(onChanged)}
          aria-label="Address name"
          className="min-h-9 w-32 rounded-lg border border-ink-100 bg-white px-2 text-[13px] font-semibold"
        />
        {address.is_default && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Default</span>
        )}
      </div>
      <p className="mt-2 text-[14px] text-ink-700">{address.address_text}</p>
      <div className="mt-2 flex gap-4 text-[13px] font-medium">
        {!address.is_default && (
          <button className="text-ink-600 underline" onClick={() => void makeDefaultAddress(address.id).then(onChanged)}>
            Make default
          </button>
        )}
        <button className="text-ink-400 underline" onClick={() => void deleteAddress(address.id).then(onChanged)}>
          Remove
        </button>
      </div>
    </div>
  )
}

function OrdersList({ orders }: { orders: MyOrder[] }) {
  const navigate = useNavigate()
  const { addLine } = useCart()
  const { dailyMenu, tomorrowMenu } = usePublicDailyMenu()
  const [message, setMessage] = useState<Record<string, string>>({})

  // "Order again": put the same items in the cart, using today's or tomorrow's
  // CURRENT menu, prices and stock (never the old prices).
  function orderAgain(order: MyOrder) {
    const menus = [dailyMenu, tomorrowMenu].filter((m): m is NonNullable<typeof m> => Boolean(m))
    const missing: string[] = []
    let chosenDate: string | null = null
    const toAdd: Parameters<typeof addLine>[0][] = []

    for (const line of order.order_items) {
      let found = false
      for (const menu of menus) {
        if (chosenDate && menu.date !== chosenDate) continue
        const item = menu.items.find((i) => i.id === line.menu_item_id)
        const variation = item?.variations.find((v) => v.id === line.variation_id)
        const slot = menu.slots.find((s) => s.variationId === line.variation_id)
        if (item && variation && slot && slot.slotsLeft > 0) {
          chosenDate = menu.date
          toAdd.push({
            itemId: item.id,
            itemName: item.name,
            image: item.image,
            variationId: variation.id,
            variationLabel: variation.label,
            unitPrice: variation.price,
            quantity: Math.min(line.quantity, slot.slotsLeft),
            slotsLeft: slot.slotsLeft,
            menuDate: menu.date,
          })
          found = true
          break
        }
      }
      if (!found) missing.push(`${line.item_name} (${line.variation_label})`)
    }

    if (toAdd.length === 0) {
      setMessage((m) => ({ ...m, [order.id]: "None of these items are on the menu right now. Check back when a new menu is live." }))
      return
    }
    for (const input of toAdd) addLine(input)
    if (missing.length > 0) {
      setMessage((m) => ({
        ...m,
        [order.id]: `Added what's available. Not on the menu now: ${missing.join(', ')}.`,
      }))
    } else {
      navigate('/cart')
    }
  }

  if (orders.length === 0) {
    return (
      <div className="mt-10 text-center">
        <p className="text-[15px] text-ink-500">No orders on your account yet.</p>
        <Link to="/" className="mt-4 inline-block">
          <Button>Browse today's menu</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      {orders.map((o) => (
        <div key={o.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-ink-800">{o.order_number}</p>
              <p className="text-[12px] text-ink-400">
                {formatDateLong(o.menu_date)} · {o.delivery_type === 'dispatch' ? 'Delivery' : 'Pickup'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-bold text-brand-600">{formatNaira(o.total)}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  STATUS_STYLE[o.status] ?? 'bg-brand-50 text-brand-700'
                }`}
              >
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1 text-[14px] text-ink-600">
            {o.order_items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.item_name} ({i.variation_label}) × {i.quantity}
                </span>
                <span>{formatNaira(i.unit_price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
            <Link to={`/track?order=${o.order_number}&phone=${encodeURIComponent(o.customer_phone)}`}>
              <Button variant="secondary">Track</Button>
            </Link>
            <Button variant="ghost" onClick={() => orderAgain(o)}>
              Order again
            </Button>
          </div>
          {message[o.id] && <p className="mt-2 text-[13px] font-medium text-ink-500">{message[o.id]}</p>}
        </div>
      ))}
    </div>
  )
}
