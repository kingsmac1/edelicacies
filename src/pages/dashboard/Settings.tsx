import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, fetchSettings, updateSetting } from '../../lib/api/settings'
import {
  createDeliveryBand,
  createPickupWindow,
  deleteDeliveryBand,
  deletePickupWindow,
  fetchDeliveryBands,
  fetchPickupWindows,
  updateDeliveryBand,
  updatePickupWindow,
} from '../../lib/api/deliveryBands'
import type { SettingsMap, DeliveryBandRow, PickupWindowRow } from '../../types/db'
import { Button } from '../../components/ui/Button'

export function OwnerSettings() {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS)
  const [bands, setBands] = useState<DeliveryBandRow[]>([])
  const [windows, setWindows] = useState<PickupWindowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [s, b, w] = await Promise.all([fetchSettings(), fetchDeliveryBands(), fetchPickupWindows()])
      setSettings(s)
      setBands(b)
      setWindows(w)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await Promise.all([
        updateSetting('announcement_banner', settings.announcement_banner),
        updateSetting('business_hours', settings.business_hours),
        updateSetting('shop_location', settings.shop_location),
        updateSetting('slot_hold_minutes', settings.slot_hold_minutes),
        updateSetting('review_delay_hours', settings.review_delay_hours),
        updateSetting('max_delivery_km', settings.max_delivery_km),
        updateSetting('delivery_step', settings.delivery_step),
        updateSetting('pickup_instructions', settings.pickup_instructions),
        updateSetting('owner_email', settings.owner_email),
        updateSetting('expense_categories', settings.expense_categories),
      ])
      setMessage('Settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddBand() {
    const last = bands[bands.length - 1]
    await createDeliveryBand({
      min_km: last ? last.max_km : 0,
      max_km: last ? last.max_km + 3 : 2,
      price: last ? last.price + 500 : 1500,
      sort_order: bands.length,
    })
    await load()
  }

  async function handleAddWindow() {
    await createPickupWindow('New window', windows.length)
    await load()
  }

  if (loading) return <p className="text-center text-[14px] text-ink-400">Loading…</p>

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-ink-800">Settings</h1>

      <div className="mt-5 flex flex-col gap-5">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <label className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink-700">Announcement banner</span>
            <input
              type="checkbox"
              checked={settings.announcement_banner.enabled}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  announcement_banner: { ...s.announcement_banner, enabled: e.target.checked },
                }))
              }
              className="h-5 w-5 accent-brand-500"
            />
          </label>
          <input
            value={settings.announcement_banner.text}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                announcement_banner: { ...s.announcement_banner, text: e.target.value },
              }))
            }
            placeholder="Banner text shown at the top of the site"
            className="mt-3 min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <span className="text-[14px] font-semibold text-ink-700">Business hours</span>
          <input
            value={settings.business_hours.text}
            onChange={(e) => setSettings((s) => ({ ...s, business_hours: { text: e.target.value } }))}
            placeholder="e.g. Mon – Sat, 9am – 7pm"
            className="mt-3 min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <span className="text-[14px] font-semibold text-ink-700">Owner email</span>
          <p className="mt-1 text-[12px] text-ink-400">Where new-order emails are sent.</p>
          <input
            type="email"
            value={settings.owner_email.email}
            onChange={(e) => setSettings((s) => ({ ...s, owner_email: { email: e.target.value } }))}
            placeholder="you@example.com"
            className="mt-3 min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <span className="text-[14px] font-semibold text-ink-700">Shop coordinates</span>
          <p className="mt-1 text-[12px] text-ink-400">Used to calculate delivery distance and pricing.</p>
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              step="0.000001"
              value={settings.shop_location.lat}
              onChange={(e) =>
                setSettings((s) => ({ ...s, shop_location: { ...s.shop_location, lat: Number(e.target.value) } }))
              }
              className="min-h-11 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="number"
              step="0.000001"
              value={settings.shop_location.lng}
              onChange={(e) =>
                setSettings((s) => ({ ...s, shop_location: { ...s.shop_location, lng: Number(e.target.value) } }))
              }
              className="min-h-11 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <span className="text-[14px] font-semibold text-ink-700">Delivery bands</span>
          <p className="mt-1 text-[12px] text-ink-400">
            Price by distance from the shop. Beyond the last band, add the step price for every extra
            step (km).
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {bands.map((b, idx) => (
              <div key={b.id} className="flex items-center gap-2">
                <input
                  type="number"
                  value={b.min_km}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setBands((prev) => prev.map((x, i) => (i === idx ? { ...x, min_km: v } : x)))
                  }}
                  onBlur={(e) => void updateDeliveryBand(b.id, { ...b, min_km: Number(e.target.value) })}
                  className="min-h-10 w-16 rounded-lg border border-ink-100 px-2 text-[13px]"
                />
                <span className="text-ink-400">–</span>
                <input
                  type="number"
                  value={b.max_km}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setBands((prev) => prev.map((x, i) => (i === idx ? { ...x, max_km: v } : x)))
                  }}
                  onBlur={(e) => void updateDeliveryBand(b.id, { ...b, max_km: Number(e.target.value) })}
                  className="min-h-10 w-16 rounded-lg border border-ink-100 px-2 text-[13px]"
                />
                <span className="text-ink-400">km →</span>
                <input
                  type="number"
                  value={b.price}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setBands((prev) => prev.map((x, i) => (i === idx ? { ...x, price: v } : x)))
                  }}
                  onBlur={(e) => void updateDeliveryBand(b.id, { ...b, price: Number(e.target.value) })}
                  className="min-h-10 w-24 rounded-lg border border-ink-100 px-2 text-[13px]"
                />
                <button
                  onClick={() => deleteDeliveryBand(b.id).then(load)}
                  className="ml-auto text-[12px] font-semibold text-ink-400"
                >
                  Remove
                </button>
              </div>
            ))}
            <button onClick={() => void handleAddBand()} className="text-left text-[13px] font-semibold text-brand-600">
              + Add band
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-4">
            <span className="text-[13px] text-ink-600">Beyond last band: +</span>
            <input
              type="number"
              value={settings.delivery_step.step_price}
              onChange={(e) =>
                setSettings((s) => ({ ...s, delivery_step: { ...s.delivery_step, step_price: Number(e.target.value) } }))
              }
              className="min-h-10 w-24 rounded-lg border border-ink-100 px-2 text-[13px]"
            />
            <span className="text-[13px] text-ink-600">every</span>
            <input
              type="number"
              value={settings.delivery_step.step_km}
              onChange={(e) =>
                setSettings((s) => ({ ...s, delivery_step: { ...s.delivery_step, step_km: Number(e.target.value) } }))
              }
              className="min-h-10 w-16 rounded-lg border border-ink-100 px-2 text-[13px]"
            />
            <span className="text-[13px] text-ink-600">km</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13px] text-ink-600">Maximum delivery distance:</span>
            <input
              type="number"
              value={settings.max_delivery_km.km}
              onChange={(e) => setSettings((s) => ({ ...s, max_delivery_km: { km: Number(e.target.value) } }))}
              className="min-h-10 w-20 rounded-lg border border-ink-100 px-2 text-[13px]"
            />
            <span className="text-[13px] text-ink-600">km</span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <span className="text-[14px] font-semibold text-ink-700">Pickup</span>
          <textarea
            value={settings.pickup_instructions.text}
            onChange={(e) => setSettings((s) => ({ ...s, pickup_instructions: { text: e.target.value } }))}
            rows={2}
            placeholder="Pickup instructions shown at checkout"
            className="mt-2 w-full rounded-xl border border-ink-100 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-3 mb-2 text-[13px] font-medium text-ink-600">Pickup time windows</p>
          <div className="flex flex-col gap-2">
            {windows.map((w, idx) => (
              <div key={w.id} className="flex items-center gap-2">
                <input
                  value={w.label}
                  onChange={(e) => {
                    const v = e.target.value
                    setWindows((prev) => prev.map((x, i) => (i === idx ? { ...x, label: v } : x)))
                  }}
                  onBlur={(e) => void updatePickupWindow(w.id, { label: e.target.value, active: w.active })}
                  className="min-h-10 flex-1 rounded-lg border border-ink-100 px-2 text-[13px]"
                />
                <label className="flex items-center gap-1 text-[12px] text-ink-500">
                  <input
                    type="checkbox"
                    checked={w.active}
                    onChange={(e) => void updatePickupWindow(w.id, { label: w.label, active: e.target.checked }).then(load)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  Active
                </label>
                <button
                  onClick={() => deletePickupWindow(w.id).then(load)}
                  className="text-[12px] font-semibold text-ink-400"
                >
                  Remove
                </button>
              </div>
            ))}
            <button onClick={() => void handleAddWindow()} className="text-left text-[13px] font-semibold text-brand-600">
              + Add window
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <span className="text-[14px] font-semibold text-ink-700">Orders</span>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13px] text-ink-600">Cancel unpaid orders after</span>
            <input
              type="number"
              value={settings.slot_hold_minutes.minutes}
              onChange={(e) => setSettings((s) => ({ ...s, slot_hold_minutes: { minutes: Number(e.target.value) } }))}
              className="min-h-10 w-20 rounded-lg border border-ink-100 px-2 text-[13px]"
            />
            <span className="text-[13px] text-ink-600">minutes</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13px] text-ink-600">Ask for a review</span>
            <input
              type="number"
              value={settings.review_delay_hours.hours}
              onChange={(e) => setSettings((s) => ({ ...s, review_delay_hours: { hours: Number(e.target.value) } }))}
              className="min-h-10 w-20 rounded-lg border border-ink-100 px-2 text-[13px]"
            />
            <span className="text-[13px] text-ink-600">hours after delivery</span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <span className="text-[14px] font-semibold text-ink-700">Expense categories</span>
          <p className="mt-1 text-[12px] text-ink-400">Comma-separated.</p>
          <input
            value={settings.expense_categories.join(', ')}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                expense_categories: e.target.value.split(',').map((c) => c.trim()).filter(Boolean),
              }))
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </section>
      </div>

      {error && <p className="mt-4 text-[14px] font-medium text-brand-600">{error}</p>}
      {message && <p className="mt-4 text-[14px] font-medium text-emerald-600">{message}</p>}

      <Button className="mt-5" onClick={() => void handleSave()} disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
      <p className="mt-2 text-[12px] text-ink-400">
        Delivery bands and pickup windows save instantly when you edit them above.
      </p>
    </div>
  )
}
