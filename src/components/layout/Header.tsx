import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import logo from '../../assets/brand/logo-wordmark.png'

export function Header() {
  const { itemCount } = useCart()
  const { session, isOwner } = useAuth()
  const signedInCustomer = Boolean(session) && isOwner === false
  const [justAdded, setJustAdded] = useState(false)
  const prevCount = useRef(itemCount)

  useEffect(() => {
    if (itemCount > prevCount.current) {
      setJustAdded(true)
      const timeout = window.setTimeout(() => setJustAdded(false), 2500)
      prevCount.current = itemCount
      return () => window.clearTimeout(timeout)
    }
    prevCount.current = itemCount
  }, [itemCount])

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Edelicacies home">
          <img src={logo} alt="Edelicacies" className="h-11 w-auto" />
        </Link>

        <div className="relative flex items-center gap-2">
          <Link
            to="/account"
            aria-label={signedInCustomer ? 'My account' : 'Sign in or create an account'}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink-800 ring-1 ring-ink-100 transition-transform active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 20c1.2-3.6 4.2-5.5 8-5.5s6.8 1.9 8 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {signedInCustomer && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            )}
          </Link>
          {justAdded && (
            <div className="animate-fade-in-up absolute right-0 top-full mt-2 flex items-center gap-1 whitespace-nowrap rounded-full bg-ink-900 py-1.5 pl-3 pr-2 text-[12px] font-semibold text-white shadow-lg">
              Tap to checkout
              <span aria-hidden="true">→</span>
            </div>
          )}
          <Link
            to="/cart"
            aria-label="View cart"
            className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-ink-900 text-white transition-transform active:scale-95 ${justAdded ? 'scale-110' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.5 6h13M10 21a1 1 0 100-2 1 1 0 000 2zM18 21a1 1 0 100-2 1 1 0 000 2z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
