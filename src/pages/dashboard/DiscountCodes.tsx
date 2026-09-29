import { useEffect, useState } from 'react'
import {
  createDiscountCode,
  deleteDiscountCode,
  fetchDiscountCodes,
  updateDiscountCode,
  type DiscountCodeInput,
} from '../../lib/api/discountCodes'
import { formatNaira } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { SuccessModal } from '../../components/ui/SuccessModal'
import type { DiscountCodeRow } from '../../types/db'

const emptyForm: DiscountCodeInput = {
  code: '',
  percentOff: 10,
  fixedOff: null,
  startDate: null,
  endDate: null,
  maxUses: null,
  minOrderAmount: null,
  active: true,
}

export function OwnerDiscountCodes() {
  const [codes, setCodes] = useState<DiscountCodeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<DiscountCodeRow | 'new' | null>(null)
  const [form, setForm] = useState<DiscountCodeInput>(emptyForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setCodes(await fetchDiscountCodes())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openEdit(c: DiscountCodeRow) {
    setForm({
      code: c.code,
      percentOff: c.percent_off,
      fixedOff: c.fixed_off,
      startDate: c.start_date,
      endDate: c.end_date,
      maxUses: c.max_uses,
      minOrderAmount: c.min_order_amount,
      active: c.active,
    })
    setEditing(c)
  }

  async function handleSave() {
    setError(null)
    if (!form.code.trim()) return setError('Enter a code.')
    if (!form.percentOff && !form.fixedOff) return setError('Set a percent-off or a fixed-off amount.')
    try {
      if (editing === 'new') await createDiscountCode(form)
      else if (editing) await updateDiscountCode(editing.id, form)
      setEditing(null)
      setShowSaveSuccess(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this code.')
    }
  }

  async function handleDelete(id: string) {
    await deleteDiscountCode(id)
    setDeletingId(null)
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-800">Discount Codes</h1>
        <Button
          onClick={() => {
            setForm(emptyForm)
            setEditing('new')
          }}
        >
          + New code
        </Button>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">No discount codes yet.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {codes.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink-100">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-ink-800">{c.code}</p>
                <p className="text-[12px] text-ink-400">
                  {c.percent_off ? `${c.percent_off}% off` : `${formatNaira(c.fixed_off ?? 0)} off`}
                  {c.min_order_amount ? ` · min ${formatNaira(c.min_order_amount)}` : ''}
                  {c.max_uses ? ` · ${c.used_count}/${c.max_uses} used` : ` · ${c.used_count} used`}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.active ? 'bg-emerald-50 text-emerald-600' : 'bg-ink-100 text-ink-500'}`}
              >
                {c.active ? 'Active' : 'Inactive'}
              </span>
              <div className="flex gap-2 text-[12px] font-semibold">
                <button onClick={() => openEdit(c)} className="text-brand-600">
                  Edit
                </button>
                <button onClick={() => setDeletingId(c.id)} className="text-ink-400">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <button aria-label="Close" onClick={() => setEditing(null)} className="absolute inset-0 bg-ink-900/50" />
          <div className="animate-slide-up relative w-full rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-ink-800">{editing === 'new' ? 'New code' : 'Edit code'}</h2>
            <div className="mt-4 flex flex-col gap-3">
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="CODE10"
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px] uppercase"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  value={form.percentOff ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      percentOff: e.target.value ? Number(e.target.value) : null,
                      fixedOff: e.target.value ? null : f.fixedOff,
                    }))
                  }
                  placeholder="% off"
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
                <input
                  type="number"
                  value={form.fixedOff ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      fixedOff: e.target.value ? Number(e.target.value) : null,
                      percentOff: e.target.value ? null : f.percentOff,
                    }))
                  }
                  placeholder="₦ off (fixed)"
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={form.startDate ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value || null }))}
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
                <input
                  type="date"
                  value={form.endDate ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value || null }))}
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  value={form.maxUses ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Max uses"
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
                <input
                  type="number"
                  value={form.minOrderAmount ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minOrderAmount: e.target.value ? Number(e.target.value) : null }))
                  }
                  placeholder="Min order ₦"
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
              </div>
              <label className="flex items-center gap-2 text-[14px] text-ink-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-5 w-5 accent-brand-500"
                />
                Active
              </label>
              {error && <p className="text-[13px] font-medium text-brand-600">{error}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" fullWidth onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button fullWidth onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close" onClick={() => setDeletingId(null)} className="absolute inset-0 bg-ink-900/50" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <h3 className="text-lg font-semibold text-ink-800">Delete this code?</h3>
            <div className="mt-5 flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button fullWidth onClick={() => void handleDelete(deletingId)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        open={showSaveSuccess}
        title="Discount code saved!"
        onClose={() => setShowSaveSuccess(false)}
      />
    </div>
  )
}
