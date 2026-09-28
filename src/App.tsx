import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicLayout } from './components/layout/PublicLayout'
import { Home } from './pages/Home'
import { Cart } from './pages/Cart'
import { NotFound } from './pages/NotFound'

const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })))
const OrderConfirmation = lazy(() =>
  import('./pages/OrderConfirmation').then((m) => ({ default: m.OrderConfirmation })),
)
const Track = lazy(() => import('./pages/Track').then((m) => ({ default: m.Track })))
const Review = lazy(() => import('./pages/Review').then((m) => ({ default: m.Review })))
const Unsubscribe = lazy(() => import('./pages/Unsubscribe').then((m) => ({ default: m.Unsubscribe })))

const OwnerLogin = lazy(() => import('./pages/dashboard/Login').then((m) => ({ default: m.OwnerLogin })))
const OwnerLayout = lazy(() =>
  import('./pages/dashboard/OwnerLayout').then((m) => ({ default: m.OwnerLayout })),
)
const OwnerMenuItems = lazy(() =>
  import('./pages/dashboard/MenuItems').then((m) => ({ default: m.OwnerMenuItems })),
)
const OwnerDailyMenu = lazy(() =>
  import('./pages/dashboard/DailyMenu').then((m) => ({ default: m.OwnerDailyMenu })),
)
const OwnerSettings = lazy(() =>
  import('./pages/dashboard/Settings').then((m) => ({ default: m.OwnerSettings })),
)
const OwnerOrders = lazy(() => import('./pages/dashboard/Orders').then((m) => ({ default: m.OwnerOrders })))
const OwnerCustomers = lazy(() =>
  import('./pages/dashboard/Customers').then((m) => ({ default: m.OwnerCustomers })),
)
const OwnerRecords = lazy(() => import('./pages/dashboard/Records').then((m) => ({ default: m.OwnerRecords })))
const OwnerExpenses = lazy(() =>
  import('./pages/dashboard/Expenses').then((m) => ({ default: m.OwnerExpenses })),
)
const OwnerReports = lazy(() => import('./pages/dashboard/Reports').then((m) => ({ default: m.OwnerReports })))
const OwnerDiscountCodes = lazy(() =>
  import('./pages/dashboard/DiscountCodes').then((m) => ({ default: m.OwnerDiscountCodes })),
)
const OwnerReviews = lazy(() => import('./pages/dashboard/Reviews').then((m) => ({ default: m.OwnerReviews })))
const OwnerSubscribers = lazy(() =>
  import('./pages/dashboard/Subscribers').then((m) => ({ default: m.OwnerSubscribers })),
)
const OwnerEmailTemplates = lazy(() =>
  import('./pages/dashboard/EmailTemplates').then((m) => ({ default: m.OwnerEmailTemplates })),
)

function OwnerFallback() {
  return <div className="flex min-h-screen items-center justify-center text-ink-400">Loading…</div>
}

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/cart" element={<Cart />} />
        <Route
          path="/checkout"
          element={
            <Suspense fallback={<OwnerFallback />}>
              <Checkout />
            </Suspense>
          }
        />
        <Route
          path="/order-confirmation"
          element={
            <Suspense fallback={<OwnerFallback />}>
              <OrderConfirmation />
            </Suspense>
          }
        />
        <Route
          path="/track"
          element={
            <Suspense fallback={<OwnerFallback />}>
              <Track />
            </Suspense>
          }
        />
        <Route
          path="/review"
          element={
            <Suspense fallback={<OwnerFallback />}>
              <Review />
            </Suspense>
          }
        />
        <Route
          path="/unsubscribe"
          element={
            <Suspense fallback={<OwnerFallback />}>
              <Unsubscribe />
            </Suspense>
          }
        />
      </Route>

      <Route
        path="/dashboard/login"
        element={
          <Suspense fallback={<OwnerFallback />}>
            <OwnerLogin />
          </Suspense>
        }
      />
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<OwnerFallback />}>
            <OwnerLayout />
          </Suspense>
        }
      >
        <Route index element={<Navigate to="menu-items" replace />} />
        <Route path="orders" element={<OwnerOrders />} />
        <Route path="daily-menu" element={<OwnerDailyMenu />} />
        <Route path="menu-items" element={<OwnerMenuItems />} />
        <Route path="customers" element={<OwnerCustomers />} />
        <Route path="records" element={<OwnerRecords />} />
        <Route path="expenses" element={<OwnerExpenses />} />
        <Route path="reports" element={<OwnerReports />} />
        <Route path="discount-codes" element={<OwnerDiscountCodes />} />
        <Route path="reviews" element={<OwnerReviews />} />
        <Route path="subscribers" element={<OwnerSubscribers />} />
        <Route path="email-templates" element={<OwnerEmailTemplates />} />
        <Route path="settings" element={<OwnerSettings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
