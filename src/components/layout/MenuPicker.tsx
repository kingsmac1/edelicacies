import { useMemo, useState } from 'react'
import type { MenuOptionDay } from '../../lib/chat'

// Tap-to-pick menu inside the chat: large photo cards in a horizontal swipe
// row, with Today / Tomorrow tabs and a quantity stepper on each card. Prices
// and stock come from the database; the server checks everything again.
export function MenuPicker({
  days,
  disabled,
  onSend,
}: {
  days: MenuOptionDay[]
  disabled: boolean
  onSend: (text: string, selection: { code: string; quantity: number }[]) => void
}) {
  const [dayIndex, setDayIndex] = useState(0)
  const [picked, setPicked] = useState<Record<string, number>>({})
  const day = days[Math.min(dayIndex, days.length - 1)]

  const all = useMemo(() => days.flatMap((d) => d.items), [days])
  const chosen = all.filter((i) => (picked[i.code] ?? 0) > 0)
  const total = chosen.reduce((n, i) => n + i.price * picked[i.code], 0)
  const count = chosen.reduce((n, i) => n + picked[i.code], 0)

  if (!day) return null

  function change(code: string, delta: number, max: number | null) {
    setPicked((p) => {
      const next = Math.max(0, Math.min(max ?? 20, 20, (p[code] ?? 0) + delta))
      const copy = { ...p }
      if (next === 0) delete copy[code]
      else copy[code] = next
      return copy
    })
  }

  function switchDay(i: number) {
    setDayIndex(i)
    setPicked({}) // one order can only hold one day's items
  }

  function send() {
    if (chosen.length === 0 || disabled) return
    const text =
      "I'd like to order: " + chosen.map((i) => `${picked[i.code]} × ${i.name} (${i.label})`).join(', ')
    onSend(
      text,
      chosen.map((i) => ({ code: i.code, quantity: picked[i.code] })),
    )
    setPicked({})
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 px-3 pb-2 pt-3">
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            onClick={() => switchDay(i)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              i === dayIndex ? 'bg-brand-500 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
            }`}
          >
            {d.heading}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-ink-400">Swipe for more →</span>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {day.items.length === 0 && (
          <p className="p-2 text-[13px] text-ink-400">Nothing listed for this day yet.</p>
        )}
        {day.items.map((i) => {
          const qty = picked[i.code] ?? 0
          return (
            <div
              key={i.code}
              className={`w-40 shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-100 ${
                i.soldOut ? 'opacity-60' : ''
              }`}
            >
              <div className="relative flex h-24 w-full items-center justify-center overflow-hidden bg-ink-100">
                {i.image ? (
                  <img src={i.image} alt={i.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl" aria-hidden="true">
                    🍽️
                  </span>
                )}
                {i.soldOut ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-ink-900/85 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                    Sold out
                  </span>
                ) : i.left !== null && i.left <= 4 ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {i.left} left
                  </span>
                ) : null}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 min-h-[2.4em] text-[13px] font-semibold leading-snug text-ink-800">
                  {i.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-ink-400">{i.label}</p>
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <span className="text-[13px] font-bold text-brand-600">
                    ₦{i.price.toLocaleString('en-NG')}
                  </span>
                  {i.soldOut ? null : qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => change(i.code, 1, i.left)}
                      className="rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-600 active:scale-95"
                    >
                      {day.heading.startsWith('Tomorrow') ? 'Pre-order' : 'Order'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Remove one ${i.name}`}
                        onClick={() => change(i.code, -1, i.left)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-base"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-[13px] font-semibold">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${i.name}`}
                        onClick={() => change(i.code, 1, i.left)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-base text-white"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {count > 0 && (
        <div className="px-3 pb-3">
          <button
            type="button"
            disabled={disabled}
            onClick={send}
            className="w-full rounded-full bg-brand-500 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Send my order · {count} item{count === 1 ? '' : 's'} · ₦{total.toLocaleString('en-NG')}
          </button>
        </div>
      )}
    </div>
  )
}
