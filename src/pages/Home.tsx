import { useState } from 'react'
import { Hero } from '../components/home/Hero'
import { CategoryTabs } from '../components/home/CategoryTabs'
import { NotifySignup } from '../components/home/NotifySignup'
import { Testimonials } from '../components/home/Testimonials'
import { EmptyMenuState } from '../components/home/EmptyMenuState'
import { MenuItemCard } from '../components/menu/MenuItemCard'
import { VariationSheet } from '../components/menu/VariationSheet'
import { DateConflictModal } from '../components/cart/DateConflictModal'
import { usePublicDailyMenu } from '../hooks/usePublicDailyMenu'
import { useCart } from '../context/CartContext'
import { formatDateLong } from '../lib/format'
import type { DailySlot, MenuCategory, MenuItem, DailyMenu } from '../types/menu'

interface OpenContext {
  item: MenuItem
  menu: DailyMenu
}

export function Home() {
  const { loading, dailyMenu, tomorrowMenu, nextMenuDateLabel } = usePublicDailyMenu()
  const [category, setCategory] = useState<MenuCategory | 'all'>('all')
  const [openContext, setOpenContext] = useState<OpenContext | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { addLine } = useCart()

  const items = dailyMenu.items.filter((i) => category === 'all' || i.category === category)

  function handleAdd(variationId: string, quantity: number) {
    if (!openContext) return
    const { item, menu } = openContext
    const variation = item.variations.find((v) => v.id === variationId)
    if (!variation) return
    const slot = menu.slots.find((s) => s.itemId === item.id && s.variationId === variationId)
    const result = addLine({
      itemId: item.id,
      itemName: item.name,
      image: item.image,
      variationId: variation.id,
      variationLabel: variation.label,
      unitPrice: variation.price,
      quantity,
      slotsLeft: slot?.slotsLeft ?? 99,
      menuDate: menu.date,
    })
    if (result === 'added') {
      setToast(`Added ${item.name} to cart`)
      window.setTimeout(() => setToast(null), 2200)
    }
  }

  const hasToday = dailyMenu.items.length > 0
  const hasTomorrow = Boolean(tomorrowMenu && tomorrowMenu.items.length > 0)
  const heroMode = hasToday || !hasTomorrow ? 'today' : 'tomorrow'
  const heroDate = heroMode === 'tomorrow' && tomorrowMenu ? tomorrowMenu.date : dailyMenu.date

  return (
    <>
      <Hero date={heroDate} mode={heroMode} />

      <div id="menu" className="mx-auto max-w-6xl px-4">
        {loading ? (
          <MenuSkeleton />
        ) : !hasToday && !hasTomorrow ? (
          <EmptyMenuState nextDate={nextMenuDateLabel ?? undefined} />
        ) : (
          <>
            {hasToday && (
              <>
                <CategoryTabs active={category} onChange={setCategory} />
                <CategoryGroups
                  items={items}
                  slots={dailyMenu.slots}
                  showHeadings={category === 'all'}
                  onOpen={(item) => setOpenContext({ item, menu: dailyMenu })}
                />
              </>
            )}

            {hasTomorrow && tomorrowMenu && (
              <section className={hasToday ? 'mt-10 border-t border-ink-100 pt-8' : 'py-5'}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-ink-800">Tomorrow's Menu</h2>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-600">
                    Pre-order
                  </span>
                </div>
                <p className="mb-4 text-[14px] text-ink-400">
                  {formatDateLong(tomorrowMenu.date)} — order now and it'll be ready for that day.
                </p>
                <CategoryGroups
                  items={tomorrowMenu.items}
                  slots={tomorrowMenu.slots}
                  showHeadings
                  onOpen={(item) => setOpenContext({ item, menu: tomorrowMenu })}
                />
              </section>
            )}
          </>
        )}
      </div>

      <Testimonials />
      <NotifySignup />

      <VariationSheet
        key={openContext ? `${openContext.menu.date}:${openContext.item.id}` : 'closed'}
        item={openContext?.item ?? null}
        slots={openContext?.menu.slots ?? []}
        onClose={() => setOpenContext(null)}
        onAdd={handleAdd}
      />
      <DateConflictModal />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2.5 text-[14px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}

function CategoryGroups({
  items,
  slots,
  showHeadings,
  onOpen,
}: {
  items: MenuItem[]
  slots: DailySlot[]
  showHeadings: boolean
  onOpen: (item: MenuItem) => void
}) {
  const foodItems = items.filter((i) => i.category === 'food')
  const drinkItems = items.filter((i) => i.category === 'drink')

  return (
    <>
      {foodItems.length > 0 && (
        <section className="py-5">
          {showHeadings && <h3 className="mb-3 text-lg font-semibold text-ink-800">Food</h3>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {foodItems.map((item) => (
              <MenuItemCard key={item.id} item={item} slots={slots} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
      {drinkItems.length > 0 && (
        <section className="py-5">
          {showHeadings && <h3 className="mb-3 text-lg font-semibold text-ink-800">Drinks</h3>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {drinkItems.map((item) => (
              <MenuItemCard key={item.id} item={item} slots={slots} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function MenuSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
          <div className="aspect-[4/3] animate-pulse bg-ink-100" />
          <div className="space-y-2 p-3.5">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-full animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
