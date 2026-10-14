import { useEffect, useState } from 'react'
import { fetchAllMenuItems, type MenuItemWithVariations } from '../../lib/api/menuItems'
import {
  ensureDailyMenu,
  getDailyMenuByDate,
  removeSlot,
  setDailyMenuPublished,
  upsertSlot,
} from '../../lib/api/dailyMenu'
import { notifySubscribers } from '../../lib/edgeFunctions'
import type { DailyMenuRow, DailyMenuSlotRow } from '../../types/db'
import { formatDateLong, formatNaira, todayLagos } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { SuccessModal } from '../../components/ui/SuccessModal'

interface RowState {
  included: boolean
  slotsTotal: number
  showSlots: boolean
  slotId: string | null
  /** Portions still available right now (null until the slot exists). */
  slotsLeft: number | null
}

export function OwnerDailyMenu() {
  const [date, setDate] = useState(todayLagos())
  const [items, setItems] = useState<MenuItemWithVariations[]>([])
  const [menu, setMenu] = useState<DailyMenuRow | null>(null)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifyOutcome, setNotifyOutcome] = useState<
    { sent: number; total: number } | 'failed' | null
  >(null)
  const [tab, setTab] = useState<'food' | 'drink'>('food')

  async function load(forDate: string) {
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const [allItems, { menu: dailyMenu, slots }] = await Promise.all([
        fetchAllMenuItems(),
        getDailyMenuByDate(forDate),
      ])
      const active = allItems.filter((i) => i.active)
      setItems(active)
      setMenu(dailyMenu)

      const bySlotVariation = new Map<string, DailyMenuSlotRow>(slots.map((s) => [s.variation_id, s]))
      const nextRows: Record<string, RowState> = {}
      for (const item of active) {
        for (const v of item.menu_item_variations) {
          const existing = bySlotVariation.get(v.id)
          nextRows[v.id] = existing
            ? {
                included: true,
                slotsTotal: existing.slots_total,
                showSlots: existing.show_slots,
                slotId: existing.id,
                slotsLeft: existing.slots_left,
              }
            : { included: false, slotsTotal: 10, showSlots: true, slotId: null, slotsLeft: null }
        }
      }
      setRows(nextRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the daily menu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(date)
  }, [date])

  function updateRow(variationId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [variationId]: { ...prev[variationId], ...patch } }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const dailyMenu = menu ?? (await ensureDailyMenu(date))
      setMenu(dailyMenu)

      for (const item of items) {
        for (const v of item.menu_item_variations) {
          const row = rows[v.id]
          if (!row) continue
          if (row.included && row.slotsTotal > 0) {
            await upsertSlot({
              dailyMenuId: dailyMenu.id,
              menuItemId: item.id,
              variationId: v.id,
              slotsTotal: row.slotsTotal,
              showSlots: row.showSlots,
            })
          } else if (row.slotId) {
            await removeSlot(row.slotId)
          }
        }
      }
      setNotifyOutcome(null)
      setShowSaveSuccess(true)
      await load(date)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handleNotify() {
    setNotifying(true)
    try {
      const result = await notifySubscribers(date)
      // Close the "Menu saved" popup and show the outcome in its own popup.
      setShowSaveSuccess(false)
      setNotifyOutcome(result ? { sent: result.sent, total: result.subscriberCount } : 'failed')
    } finally {
      setNotifying(false)
    }
  }

  async function handleTogglePublished() {
    const dailyMenu = menu ?? (await ensureDailyMenu(date))
    const next = !dailyMenu.published
    await setDailyMenuPublished(dailyMenu.id, next)
    setMenu({ ...dailyMenu, published: next })
  }

  const includedCount = Object.values(rows).filter((r) => r.included).length

  // Everything ticked for this day, flattened, for the summary strip at the top.
  const selected = items.flatMap((item) =>
    item.menu_item_variations
      .filter((v) => rows[v.id]?.included)
      .map((v) => ({
        variationId: v.id,
        category: item.category,
        name: item.name,
        label: v.label,
        slots: rows[v.id].slotsTotal,
      })),
  )
  const countFor = (cat: 'food' | 'drink') => selected.filter((s) => s.category === cat).length
  const hasFood = items.some((i) => i.category === 'food')
  const hasDrink = items.some((i) => i.category === 'drink')

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Daily Menu &amp; Slots</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
        />
        {menu && (
          <button
            onClick={() => void handleTogglePublished()}
            className={`min-h-11 rounded-full px-4 text-[13px] font-semibold ${
              menu.published ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500'
            }`}
          >
            {menu.published ? 'Published (visible on site)' : 'Draft (hidden)'}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-[14px] font-medium text-brand-600">{error}</p>}
      {message && <p className="mt-3 text-[14px] font-medium text-emerald-600">{message}</p>}

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">
          No active menu items yet — add some under Menu Items first.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-3 ring-1 ring-ink-100">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
              Selected for {formatDateLong(date)} ({selected.length})
            </p>
            {selected.length === 0 ? (
              <p className="text-[13px] text-ink-400">Nothing selected yet. Tick items below.</p>
            ) : (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {selected.map((s) => (
                  <span
                    key={s.variationId}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 text-[12.5px] ${
                      s.category === 'food' ? 'bg-brand-50 text-brand-700' : 'bg-sky-50 text-sky-700'
                    }`}
                  >
                    <button type="button" onClick={() => setTab(s.category)} className="font-medium">
                      {s.name} · {s.label} <span className="opacity-60">×{s.slots}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${s.name} ${s.label}`}
                      onClick={() => updateRow(s.variationId, { included: false })}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[13px] leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2" role="tablist">
            {(
              [
                ['food', 'Food', hasFood],
                ['drink', 'Drinks', hasDrink],
              ] as const
            ).map(([value, label, available]) =>
              available ? (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`min-h-11 rounded-full px-5 text-[14px] font-semibold ${
                    tab === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
                  }`}
                >
                  {label}
                  <span className={`ml-2 text-[12px] ${tab === value ? 'text-ink-200' : 'text-ink-400'}`}>
                    {countFor(value)} selected
                  </span>
                </button>
              ) : null,
            )}
          </div>

          {(['food', 'drink'] as const).map((cat) => {
            const catItems = items.filter((i) => i.category === cat)
            if (catItems.length === 0 || cat !== tab) return null
            return (
              <section key={cat}>
                <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
                  {cat === 'food' ? 'Food' : 'Drinks'}
                </h2>
                <div className="flex flex-col gap-3">
                  {catItems.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
                      <p className="text-[15px] font-semibold text-ink-800">{item.name}</p>
                      <div className="mt-2 flex flex-col gap-2">
                        {item.menu_item_variations.map((v) => {
                          const row = rows[v.id]
                          if (!row) return null
                          return (
                            <div
                              key={v.id}
                              className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 p-2.5"
                            >
                              <label className="flex min-w-[9rem] flex-1 items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={row.included}
                                  onChange={(e) => updateRow(v.id, { included: e.target.checked })}
                                  className="h-5 w-5 accent-brand-500"
                                />
                                <span className="text-[14px] text-ink-700">
                                  {v.label} · {formatNaira(v.price)}
                                </span>
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={row.slotsTotal}
                                disabled={!row.included}
                                onChange={(e) => updateRow(v.id, { slotsTotal: Number(e.target.value) })}
                                className="min-h-9 w-20 rounded-lg border border-ink-100 px-2 text-[13px] disabled:opacity-40"
                                aria-label={`Total slots for ${v.label}`}
                                title="Total portions for the day"
                              />
                              {row.included && typeof row.slotsLeft === 'number' && (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                                    row.slotsLeft <= 0 ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {row.slotsLeft <= 0 ? 'Sold out' : `${row.slotsLeft} left`}
                                </span>
                              )}
                              <label className="flex items-center gap-1.5 text-[12px] text-ink-500">
                                <input
                                  type="checkbox"
                                  checked={row.showSlots}
                                  disabled={!row.included}
                                  onChange={(e) => updateRow(v.id, { showSlots: e.target.checked })}
                                  className="h-4 w-4 accent-brand-500 disabled:opacity-40"
                                />
                                Show slots left
                              </label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <div className="sticky bottom-20 mt-6 flex items-center justify-between rounded-2xl bg-white p-3 shadow-lg ring-1 ring-ink-100 sm:bottom-4">
        <span className="pl-2 text-[13px] text-ink-500">{includedCount} variation(s) selected</span>
        <Button onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save menu for ' + formatDateLong(date)}
        </Button>
      </div>

      <SuccessModal
        open={showSaveSuccess}
        title="Menu saved!"
        message={`${formatDateLong(date)}'s menu is up to date${menu?.published ? ' and live on the site' : ' (still in draft)'}.`}
        onClose={() => setShowSaveSuccess(false)}
      >
        <Button fullWidth onClick={() => void handleNotify()} disabled={notifying}>
          {notifying ? 'Sending…' : 'Notify subscribers about this menu'}
        </Button>
      </SuccessModal>

      <SuccessModal
        open={notifyOutcome !== null}
        tone={notifyOutcome === 'failed' || (notifyOutcome !== null && notifyOutcome.sent < notifyOutcome.total) ? 'warning' : 'success'}
        title={
          notifyOutcome === 'failed'
            ? 'Could not notify subscribers'
            : notifyOutcome && notifyOutcome.total === 0
              ? 'No subscribers yet'
              : notifyOutcome && notifyOutcome.sent < notifyOutcome.total
                ? 'Some emails did not go out'
                : 'Subscribers notified!'
        }
        message={
          notifyOutcome === 'failed'
            ? 'Something went wrong while sending. Please try again in a moment.'
            : notifyOutcome
              ? notifyOutcome.total === 0
                ? 'Nobody has subscribed for menu alerts yet.'
                : `${formatDateLong(date)}'s menu was emailed to ${notifyOutcome.sent} of ${notifyOutcome.total} subscriber${notifyOutcome.total === 1 ? '' : 's'}.`
              : undefined
        }
        onClose={() => setNotifyOutcome(null)}
      />
    </div>
  )
}
