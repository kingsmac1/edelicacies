import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { AnnouncementBar } from './AnnouncementBar'
import { WhatsAppFab } from './WhatsAppFab'

// Pages with their own fixed bottom action bar hide the footer and the
// WhatsApp FAB so nothing overlaps the bar.
const FIXED_BOTTOM_BAR_ROUTES = new Set(['/cart', '/checkout'])

export function PublicLayout() {
  const location = useLocation()
  const hasFixedBottomBar = FIXED_BOTTOM_BAR_ROUTES.has(location.pathname)

  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      {!hasFixedBottomBar && <Footer />}
      {!hasFixedBottomBar && <WhatsAppFab />}
    </div>
  )
}
