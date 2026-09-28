import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'

const NAV_ITEMS = [
  { to: '/dashboard/orders', label: 'Orders' },
  { to: '/dashboard/daily-menu', label: 'Daily Menu & Slots' },
  { to: '/dashboard/menu-items', label: 'Menu Items' },
  { to: '/dashboard/customers', label: 'Customers' },
  { to: '/dashboard/records', label: 'Records' },
  { to: '/dashboard/expenses', label: 'Expenses' },
  { to: '/dashboard/reports', label: 'Reports' },
  { to: '/dashboard/discount-codes', label: 'Discount Codes' },
  { to: '/dashboard/reviews', label: 'Reviews' },
  { to: '/dashboard/subscribers', label: 'Subscribers' },
  { to: '/dashboard/settings', label: 'Settings' },
]

export function OwnerLayout() {
  const { session, loading, signOut } = useAuth()

  if (!isSupabaseConfigured) return <Navigate to="/dashboard/login" replace />
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink-400">Loading…</div>
  }
  if (!session) return <Navigate to="/dashboard/login" replace />

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-display text-lg font-medium text-ink-800">Edelicacies Owner</span>
          <button
            onClick={() => void signOut()}
            className="min-h-9 rounded-full bg-ink-50 px-3.5 text-[13px] font-semibold text-ink-500"
          >
            Sign out
          </button>
        </div>
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                  isActive ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
