import { useState, type ComponentType, type SVGProps } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'
import logo from '../../assets/brand/logo-wordmark-white.png'
import logoMark from '../../assets/brand/logo-mark-white.png'
import {
  IconOrders,
  IconCalendar,
  IconBowl,
  IconUsers,
  IconFileText,
  IconWallet,
  IconBarChart,
  IconTag,
  IconStar,
  IconBell,
  IconMail,
  IconSliders,
  IconMore,
} from '../../components/dashboard/icons'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard/orders', label: 'Orders', icon: IconOrders },
  { to: '/dashboard/daily-menu', label: 'Daily Menu & Slots', icon: IconCalendar },
  { to: '/dashboard/menu-items', label: 'Menu Items', icon: IconBowl },
  { to: '/dashboard/customers', label: 'Customers', icon: IconUsers },
  { to: '/dashboard/records', label: 'Records', icon: IconFileText },
  { to: '/dashboard/expenses', label: 'Expenses', icon: IconWallet },
  { to: '/dashboard/reports', label: 'Reports', icon: IconBarChart },
  { to: '/dashboard/discount-codes', label: 'Discount Codes', icon: IconTag },
  { to: '/dashboard/reviews', label: 'Reviews', icon: IconStar },
  { to: '/dashboard/subscribers', label: 'Subscribers', icon: IconBell },
  { to: '/dashboard/email-templates', label: 'Email Templates', icon: IconMail },
  { to: '/dashboard/settings', label: 'Settings', icon: IconSliders },
]

const PRIMARY_MOBILE_PATHS = ['/dashboard/orders', '/dashboard/daily-menu', '/dashboard/menu-items']

export function OwnerLayout() {
  const { session, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  if (!isSupabaseConfigured) return <Navigate to="/dashboard/login" replace />
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink-400">Loading…</div>
  }
  if (!session) return <Navigate to="/dashboard/login" replace />

  const primaryItems = NAV_ITEMS.filter((item) => PRIMARY_MOBILE_PATHS.includes(item.to))
  const moreItems = NAV_ITEMS.filter((item) => !PRIMARY_MOBILE_PATHS.includes(item.to))
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.to))

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Desktop left sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 shrink-0 flex-col bg-brand-500 sm:flex">
        <div className="flex h-20 items-center border-b border-white/15 px-5">
          <img src={logo} alt="Edelicacies" className="h-11 w-auto" />
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors ${
                  isActive ? 'bg-white text-brand-600' : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/15 p-3">
          <button
            onClick={() => void signOut()}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-white/15 text-[13px] font-semibold text-white hover:bg-white/25"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col sm:ml-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink-100 bg-white px-4 sm:hidden">
          <div className="flex items-center gap-2">
            <img src={logoMark} alt="" className="h-8 w-auto rounded-md bg-brand-500 p-1" />
            <span className="font-display text-lg font-medium text-ink-800">Edelicacies Owner</span>
          </div>
          <button
            onClick={() => void signOut()}
            className="min-h-9 rounded-full bg-ink-50 px-3.5 text-[13px] font-semibold text-ink-500"
          >
            Sign out
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/15 bg-brand-500 pb-[env(safe-area-inset-bottom)] sm:hidden">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label === 'Daily Menu & Slots' ? 'Daily Menu' : item.label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isMoreActive ? 'text-white' : 'text-white/60'
            }`}
          >
            <IconMore className="h-5 w-5" />
            More
          </button>
        </nav>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden">
          <button aria-label="Close" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-ink-900/50" />
          <div className="animate-slide-up relative w-full rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <h2 className="mb-4 text-[15px] font-semibold text-ink-800">More</h2>
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setMoreOpen(false)
                    navigate(item.to)
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-[12px] font-medium ${
                    location.pathname.startsWith(item.to) ? 'bg-brand-50 text-brand-600' : 'bg-ink-50 text-ink-600'
                  }`}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
