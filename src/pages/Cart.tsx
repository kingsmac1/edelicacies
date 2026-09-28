import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { formatNaira, formatDateLong } from '../lib/format'
import { Button } from '../components/ui/Button'

export function Cart() {
  const { lines, subtotal, menuDate, removeLine, updateQuantity } = useCart()

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-50 text-2xl">🛒</div>
        <h1 className="mt-5 text-xl font-semibold text-ink-800">Your cart is empty</h1>
        <p className="mt-2 text-[15px] text-ink-400">Add something delicious from today's menu.</p>
        <Link to="/">
          <Button className="mt-6">Browse menu</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[70vh] max-w-2xl px-4 pb-32 pt-6">
      <h1 className="text-2xl font-semibold text-ink-800">Your cart</h1>
      {menuDate && (
        <p className="mt-1 text-[14px] text-ink-400">For {formatDateLong(menuDate)}</p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {lines.map((line) => (
          <div key={line.id} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink-100">
            {line.image ? (
              <img src={line.image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-xl">
                🍽️
              </div>
            )}
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <p className="text-[15px] font-semibold leading-snug text-ink-800">{line.itemName}</p>
                <p className="text-[13px] text-ink-400">{line.variationLabel}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(line.id, line.quantity - 1)}
                    aria-label="Decrease quantity"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-base font-semibold text-ink-700"
                  >
                    &minus;
                  </button>
                  <span className="w-4 text-center font-medium">{line.quantity}</span>
                  <button
                    onClick={() => updateQuantity(line.id, line.quantity + 1)}
                    disabled={line.quantity >= line.slotsLeft}
                    aria-label="Increase quantity"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-base font-semibold text-ink-700 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <span className="text-[15px] font-bold text-brand-600">
                  {formatNaira(line.unitPrice * line.quantity)}
                </span>
              </div>
            </div>
            <button
              onClick={() => removeLine(line.id)}
              aria-label={`Remove ${line.itemName}`}
              className="self-start text-ink-300 hover:text-brand-500"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] text-ink-500">Subtotal</span>
            <span className="text-lg font-bold text-ink-800">{formatNaira(subtotal)}</span>
          </div>
          <Link to="/checkout">
            <Button fullWidth size="lg">
              Proceed to checkout
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
