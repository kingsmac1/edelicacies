import clsx from 'clsx'
import type { DailySlot, MenuItem } from '../../types/menu'
import { formatNaira } from '../../lib/format'

interface Props {
  item: MenuItem
  slots: DailySlot[]
  onOpen: (item: MenuItem) => void
}

export function MenuItemCard({ item, slots, onOpen }: Props) {
  const itemSlots = slots.filter((s) => s.itemId === item.id)
  const totalLeft = itemSlots.reduce((sum, s) => sum + s.slotsLeft, 0)
  const soldOut = itemSlots.length > 0 && totalLeft <= 0
  const showSlots = itemSlots.some((s) => s.showSlots)

  const prices = item.variations.map((v) => v.price)
  const priceLabel =
    prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
      ? `From ${formatNaira(Math.min(...prices))}`
      : formatNaira(prices[0])

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      disabled={soldOut}
      className={clsx(
        'group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-ink-100 transition-transform active:scale-[0.98]',
        soldOut && 'opacity-60',
      )}
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-ink-100">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-3xl" aria-hidden="true">
            🍽️
          </span>
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-ink-900/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            Sold out
          </span>
        )}
        {!soldOut && showSlots && totalLeft <= 4 && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white">
            {totalLeft} left
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-800">{item.name}</h3>
        <p className="line-clamp-2 text-[13px] leading-snug text-ink-400">{item.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[15px] font-bold text-brand-600">{priceLabel}</span>
          {!soldOut && (
            <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-brand-50 px-3 text-[13px] font-semibold text-brand-600">
              Add
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
