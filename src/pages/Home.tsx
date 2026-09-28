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
import type { MenuCategory, MenuItem } from '../types/menu'

export function Home() {
  const { loading, dailyMenu, nextMenuDateLabel } = usePublicDailyMenu()
  const [category, setCategory] = useState<MenuCategory | 'all'>('all')
  const [openItem, setOpenItem] = useState<MenuItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { addLine } = useCart()

  const items = dailyMenu.items.filter((i) => category === 'all' || i.category === category)
  const foodItems = items.filter((i) => i.category === 'food')
  const drinkItems = items.filter((i) => i.category === 'drink')

  function handleAdd(variationId: string, quantity: number) {
    if (!openItem) return
    const variation = openItem.variations.find((v) => v.id === variationId)
    if (!variation) return
    const slot = dailyMenu.slots.find(
      (s) => s.itemId === openItem.id && s.variationId === variationId,
    )
    const result = addLine({
      itemId: openItem.id,
      itemName: openItem.name,
      image: openItem.image,
      variationId: variation.id,
      variationLabel: variation.label,
      unitPrice: variation.price,
      quantity,
      slotsLeft: slot?.slotsLeft ?? 99,
      menuDate: dailyMenu.date,
    })
    if (result === 'added') {
      setToast(`Added ${openItem.name} to cart`)
      window.setTimeout(() => setToast(null), 2200)
    }
  }

  return (
    <>
      <Hero date={dailyMenu.date} />

      <div id="menu" className="mx-auto max-w-6xl px-4">
        {loading ? (
          <MenuSkeleton />
        ) : dailyMenu.items.length === 0 ? (
          <EmptyMenuState nextDate={nextMenuDateLabel ?? undefined} />
        ) : (
          <>
            <CategoryTabs active={category} onChange={setCategory} />
            {foodItems.length > 0 && (
              <section className="py-5">
                {category === 'all' && <h2 className="mb-3 text-lg font-semibold text-ink-800">Food</h2>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {foodItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} slots={dailyMenu.slots} onOpen={setOpenItem} />
                  ))}
                </div>
              </section>
            )}
            {drinkItems.length > 0 && (
              <section className="py-5">
                {category === 'all' && <h2 className="mb-3 text-lg font-semibold text-ink-800">Drinks</h2>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {drinkItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} slots={dailyMenu.slots} onOpen={setOpenItem} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Testimonials />
      <NotifySignup />

      <VariationSheet
        key={openItem?.id ?? 'closed'}
        item={openItem}
        slots={dailyMenu.slots}
        onClose={() => setOpenItem(null)}
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
