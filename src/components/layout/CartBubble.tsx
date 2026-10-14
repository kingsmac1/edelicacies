import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'

// Floating cart button that sits above the chat bubble. Once something is in
// the cart it gets a looping outline pulse and a "complete your purchase" label.
export function CartBubble() {
  const { itemCount } = useCart()
  const hasItems = itemCount > 0
  if (!hasItems) return null

  return (
    <>
      {hasItems && (
        <Link
          to="/cart"
          tabIndex={-1}
          aria-hidden="true"
          className="fixed bottom-[96px] right-[76px] z-40 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-800 shadow-lg shadow-black/15 ring-1 ring-black/5 active:scale-95"
        >
          Complete your purchase here
        </Link>
      )}
      <Link
        to="/cart"
        aria-label={hasItems ? `Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Open cart'}
        className="fixed bottom-[88px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 text-white shadow-lg shadow-black/20 active:scale-95"
      >
        {hasItems && <span className="cart-bubble-ring" aria-hidden="true" />}
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M2 3h3l2.4 12.2a1 1 0 001 .8h9.7a1 1 0 001-.8L21 7H6" />
        </svg>
        {hasItems && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold leading-none text-white">
            {itemCount}
          </span>
        )}
      </Link>
    </>
  )
}
