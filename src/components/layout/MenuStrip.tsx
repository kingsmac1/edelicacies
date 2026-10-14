import { useMemo } from 'react'
import { usePublicDailyMenu } from '../../hooks/usePublicDailyMenu'
import { MenuPicker } from './MenuPicker'
import type { MenuOptionDay } from '../../lib/chat'
import type { DailyMenu } from '../../types/menu'

// Same short code the assistant uses for a menu line (first 6 characters of
// the variation id). The server re-checks every code against the live menu.
const codeOf = (variationId: string) => variationId.replace(/-/g, '').slice(0, 6)

function toDay(menu: DailyMenu, heading: string): MenuOptionDay {
  const items: MenuOptionDay['items'] = []
  for (const item of menu.items) {
    for (const v of item.variations) {
      const slot = menu.slots.find((s) => s.itemId === item.id && s.variationId === v.id)
      const left = slot?.slotsLeft ?? 99
      items.push({
        code: codeOf(v.id),
        name: item.name,
        category: item.category,
        image: item.image || null,
        label: v.label,
        price: v.price,
        left: slot?.showSlots && left > 0 ? left : null,
        soldOut: left <= 0,
      })
    }
  }
  return { date: menu.date, heading, items }
}

// Today's (and tomorrow's pre-order) menu, shown at the top of the /chat page
// so customers can order without having to ask first.
export function MenuStrip({
  disabled,
  onSend,
}: {
  disabled: boolean
  onSend: (text: string, selection: { code: string; quantity: number }[]) => void
}) {
  const { loading, dailyMenu, tomorrowMenu } = usePublicDailyMenu()

  const days = useMemo(() => {
    const out: MenuOptionDay[] = []
    if (dailyMenu.items.length > 0) out.push(toDay(dailyMenu, "Today's menu"))
    if (tomorrowMenu && tomorrowMenu.items.length > 0) out.push(toDay(tomorrowMenu, "Tomorrow's menu"))
    return out
  }, [dailyMenu, tomorrowMenu])

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden px-3 py-4" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-44 w-40 shrink-0 animate-pulse rounded-2xl bg-ink-100" />
        ))}
      </div>
    )
  }
  if (days.length === 0) return null

  return (
    <div className="border-b border-ink-100 bg-cream-50">
      <MenuPicker days={days} disabled={disabled} onSend={onSend} />
    </div>
  )
}
