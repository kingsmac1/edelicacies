import { useState } from 'react'
import clsx from 'clsx'
import type { DailySlot, MenuItem } from '../../types/menu'
import { formatNaira } from '../../lib/format'
import { Button } from '../ui/Button'

interface Props {
  item: MenuItem | null
  slots: DailySlot[]
  onClose: () => void
  onAdd: (variationId: string, quantity: number) => void
}

// The parent mounts this with `key={item?.id}` so opening a different item
// remounts the sheet and this initializer runs again — no effect needed.
function firstAvailableVariationId(item: MenuItem | null, slots: DailySlot[]): string | null {
  if (!item) return null
  const firstAvailable = item.variations.find((v) => {
    const slot = slots.find((s) => s.itemId === item.id && s.variationId === v.id)
    return !slot || slot.slotsLeft > 0
  })
  return firstAvailable?.id ?? item.variations[0]?.id ?? null
}

export function VariationSheet({ item, slots, onClose, onAdd }: Props) {
  const [variationId, setVariationId] = useState<string | null>(() =>
    firstAvailableVariationId(item, slots),
  )
  const [quantity, setQuantity] = useState(1)

  if (!item) return null

  const variation = item.variations.find((v) => v.id === variationId) ?? item.variations[0]
  const slot = slots.find((s) => s.itemId === item.id && s.variationId === variation.id)
  const slotsLeft = slot ? slot.slotsLeft : 99
  const soldOut = slotsLeft <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />
      <div className="animate-slide-up relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
        <div className="relative flex aspect-[16/10] w-full items-center justify-center bg-ink-100">
          {item.image ? (
            <img src={item.image} alt={item.name} className="h-full w-full object-cover sm:rounded-t-3xl" />
          ) : (
            <span className="text-5xl" aria-hidden="true">
              🍽️
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-700"
          >
            &times;
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-xl font-semibold text-ink-800">{item.name}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-400">{item.description}</p>

          {item.variations.length > 1 && (
            <div className="mt-5">
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
                Choose size
              </p>
              <div className="flex flex-col gap-2">
                {item.variations.map((v) => {
                  const vSlot = slots.find((s) => s.itemId === item.id && s.variationId === v.id)
                  const vSoldOut = vSlot ? vSlot.slotsLeft <= 0 : false
                  const active = v.id === variationId
                  return (
                    <button
                      key={v.id}
                      disabled={vSoldOut}
                      onClick={() => setVariationId(v.id)}
                      className={clsx(
                        'flex min-h-12 items-center justify-between rounded-xl border px-4 text-left transition-colors',
                        active ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white',
                        vSoldOut && 'opacity-50',
                      )}
                    >
                      <span className="text-[15px] font-medium text-ink-800">
                        {v.label}
                        {vSoldOut && <span className="ml-2 text-xs text-ink-400">Sold out</span>}
                      </span>
                      <span className="text-[15px] font-semibold text-brand-600">{formatNaira(v.price)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!soldOut && vSlotShowsLeft(slot) && (
            <p className="mt-3 text-[13px] font-medium text-brand-600">Only {slotsLeft} left today</p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-400">Quantity</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-lg font-semibold text-ink-700 disabled:opacity-40"
              >
                &minus;
              </button>
              <span className="w-6 text-center text-lg font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(slotsLeft || 99, q + 1))}
                disabled={quantity >= slotsLeft}
                aria-label="Increase quantity"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-lg font-semibold text-ink-700 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-6"
            disabled={soldOut}
            onClick={() => {
              onAdd(variation.id, quantity)
              onClose()
            }}
          >
            {soldOut ? 'Sold out' : `Add ${formatNaira(variation.price * quantity)} to cart`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function vSlotShowsLeft(slot: DailySlot | undefined) {
  return Boolean(slot?.showSlots && slot.slotsLeft <= 6)
}
