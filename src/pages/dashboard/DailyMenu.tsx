import { useEffect, useState } from 'react'
import { fetchAllMenuItems, type MenuItemWithVariations } from '../../lib/api/menuItems'
import {
  copyDayToDate,
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
  const [copyFrom, setCopyFrom] = useState('')
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState<string | null>(null)

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
              }
            : { included: false, slotsTotal: 10, showSlots: true, slotId: null }
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
      setNotifyResult(null)
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
    setNotifyResult(null)
    try {
      const result = await notifySubscribers(date)
      setNotifyResult(
        result ? `Sent to ${result.sent} of ${result.subscriberCount} subscribers.` : 'Could not send right now.',
      )
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

  async function handleCopy() {
    if (!copyFrom) return
    setSaving(true)
    setError(null)
    try {
      const count = await copyDayToDate(copyFrom, date)
      setMessage(count > 0 ? `Copied ${count} item(s) from ${formatDateLong(copyFrom)}.` : 'That date has no menu to copy.')
      await load(date)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy that menu.')
    } finally {
      setSaving(false)
    }
  }

  const includedCount = Object.values(rows).filter((r) => r.included).length

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

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-ink-100">
        <span className="text-[13px] font-medium text-ink-500">Copy from</span>
        <input
          type="date"
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value)}
          className="min-h-10 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
        <Button size="md" variant="secondary" onClick={() => void handleCopy()} disabled={!copyFrom || saving}>
          Copy to {formatDateLong(date)}
        </Button>
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
        <div className="mt-4 flex flex-col gap-8">
          {(['food', 'drink'] as const).map((cat) => {
            const catItems = items.filter((i) => i.category === cat)
            if (catItems.length === 0) return null
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
                                aria-label={`Slots for ${v.label}`}
                              />
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
        {notifyResult && <p className="text-[13px] text-ink-500">{notifyResult}</p>}
      </SuccessModal>
    </div>
  )
}
