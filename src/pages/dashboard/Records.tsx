import { useEffect, useMemo, useState } from 'react'
import {
  createManualSale,
  deleteManualSale,
  fetchManualSales,
  fetchOnlinePaidOrders,
  setManualSalePaid,
  updateManualSale,
  type ManualSaleInput,
} from '../../lib/api/records'
import { formatNaira, todayLagos } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import type { ManualSaleRow, OrderRow } from '../../types/db'

interface UnifiedRecord {
  id: string
  source: 'online' | 'manual'
  date: string
  customerName: string
  customerPhone: string
  amount: number
  deliveryFee: number
  paid: boolean
  paymentMethod: string
  note: string
  raw: ManualSaleRow | OrderRow
}

function startOfRange(preset: string): { start: string; end: string } {
  const today = todayLagos()
  if (preset === 'today') return { start: today, end: today }
  const d = new Date(today)
  if (preset === 'week') {
    const start = new Date(d)
    start.setDate(d.getDate() - 6)
    return { start: start.toISOString().slice(0, 10), end: today }
  }
  if (preset === 'month') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    return { start: start.toISOString().slice(0, 10), end: today }
  }
  return { start: '2020-01-01', end: today }
}

const emptyForm: ManualSaleInput = {
  saleDate: todayLagos(),
  customerName: '',
  customerPhone: '',
  itemsText: '',
  amount: 0,
  deliveryFee: 0,
  paymentMethod: 'Cash',
  note: '',
  paid: true,
}

export function OwnerRecords() {
  const [manual, setManual] = useState<ManualSaleRow[]>([])
  const [online, setOnline] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState('month')
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'online' | 'manual'>('all')
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [editing, setEditing] = useState<ManualSaleRow | 'new' | null>(null)
  const [form, setForm] = useState<ManualSaleInput>(emptyForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [m, o] = await Promise.all([fetchManualSales(), fetchOnlinePaidOrders()])
      setManual(m)
      setOnline(o)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const range = customRange ?? startOfRange(preset)

  const records: UnifiedRecord[] = useMemo(() => {
    const fromManual: UnifiedRecord[] = manual.map((m) => ({
      id: m.id,
      source: 'manual',
      date: m.sale_date,
      customerName: m.customer_name ?? '',
      customerPhone: m.customer_phone ?? '',
      amount: m.amount + m.delivery_fee,
      deliveryFee: m.delivery_fee,
      paid: m.paid,
      paymentMethod: m.payment_method ?? '',
      note: m.note ?? '',
      raw: m,
    }))
    const fromOnline: UnifiedRecord[] = online.map((o) => ({
      id: o.id,
      source: 'online',
      date: o.menu_date,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      amount: o.total,
      deliveryFee: o.dispatch_fee_final ?? o.dispatch_fee_estimate ?? 0,
      paid: true,
      paymentMethod: 'Online',
      note: o.order_number,
      raw: o,
    }))
    return [...fromManual, ...fromOnline]
      .filter((r) => r.date >= range.start && r.date <= range.end)
      .filter((r) => sourceFilter === 'all' || r.source === sourceFilter)
      .filter((r) => paidFilter === 'all' || (paidFilter === 'paid') === r.paid)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [manual, online, range.start, range.end, sourceFilter, paidFilter])

  const totals = records.reduce(
    (acc, r) => {
      acc.count++
      acc.amount += r.amount
      if (r.paid) acc.paid += r.amount
      else acc.unpaid += r.amount
      acc.dispatch += r.deliveryFee
      return acc
    },
    { count: 0, amount: 0, paid: 0, unpaid: 0, dispatch: 0 },
  )

  function openEdit(record: UnifiedRecord) {
    if (record.source !== 'manual') return
    const m = record.raw as ManualSaleRow
    setForm({
      saleDate: m.sale_date,
      customerName: m.customer_name ?? '',
      customerPhone: m.customer_phone ?? '',
      itemsText: m.items_text ?? '',
      amount: m.amount,
      deliveryFee: m.delivery_fee,
      paymentMethod: m.payment_method ?? '',
      note: m.note ?? '',
      paid: m.paid,
    })
    setEditing(m)
  }

  async function handleSave() {
    if (editing === 'new') await createManualSale(form)
    else if (editing) await updateManualSale(editing.id, form)
    setEditing(null)
    await load()
  }

  async function handleDelete(id: string) {
    await deleteManualSale(id)
    setDeletingId(null)
    await load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-800">Records</h1>
        <Button
          onClick={() => {
            setForm(emptyForm)
            setEditing('new')
          }}
        >
          + Manual entry
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(['today', 'week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPreset(p)
              setCustomRange(null)
            }}
            className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold capitalize ${
              !customRange && preset === p ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'
            }`}
          >
            {p === 'all' ? 'All time' : p}
          </button>
        ))}
        <input
          type="date"
          value={customRange?.start ?? ''}
          onChange={(e) => setCustomRange({ start: e.target.value, end: customRange?.end ?? todayLagos() })}
          className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
        <input
          type="date"
          value={customRange?.end ?? ''}
          onChange={(e) => setCustomRange({ start: customRange?.start ?? '2020-01-01', end: e.target.value })}
          className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
          className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
        >
          <option value="all">All sources</option>
          <option value="online">Online</option>
          <option value="manual">Manual</option>
        </select>
        <select
          value={paidFilter}
          onChange={(e) => setPaidFilter(e.target.value as typeof paidFilter)}
          className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
        >
          <option value="all">Paid & unpaid</option>
          <option value="paid">Paid only</option>
          <option value="unpaid">Unpaid only</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['Sales', totals.count],
          ['Total', formatNaira(totals.amount)],
          ['Paid', formatNaira(totals.paid)],
          ['Unpaid', formatNaira(totals.unpaid)],
          ['Dispatch fees', formatNaira(totals.dispatch)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-3 text-center ring-1 ring-ink-100">
            <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
            <p className="mt-1 text-[15px] font-bold text-ink-800">{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : records.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">No records in this range.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {records.map((r) => (
            <div key={`${r.source}-${r.id}`} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink-100">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink-800">
                  {r.customerName || 'Walk-in'} <span className="text-ink-300">· {r.date}</span>
                </p>
                <p className="text-[12px] text-ink-400">
                  {r.source === 'online' ? `Online · ${r.note}` : `${r.paymentMethod || 'Manual'}${r.note ? ` · ${r.note}` : ''}`}
                </p>
              </div>
              <span className="text-[14px] font-semibold text-ink-800">{formatNaira(r.amount)}</span>
              {r.source === 'manual' ? (
                <button
                  onClick={() => void setManualSalePaid(r.id, !r.paid).then(load)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.paid ? 'bg-emerald-50 text-emerald-600' : 'bg-ink-100 text-ink-500'}`}
                >
                  {r.paid ? 'Paid' : 'Unpaid'}
                </button>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                  Paid
                </span>
              )}
              {r.source === 'manual' && (
                <div className="flex gap-2 text-[12px] font-semibold">
                  <button onClick={() => openEdit(r)} className="text-brand-600">
                    Edit
                  </button>
                  <button onClick={() => setDeletingId(r.id)} className="text-ink-400">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <button aria-label="Close" onClick={() => setEditing(null)} className="absolute inset-0 bg-ink-900/50" />
          <div className="animate-slide-up relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-ink-800">
              {editing === 'new' ? 'Add manual sale' : 'Edit sale'}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <input
                type="date"
                value={form.saleDate}
                onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))}
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
              <input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Customer name"
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
              <input
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                placeholder="Phone (optional)"
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
              <textarea
                value={form.itemsText}
                onChange={(e) => setForm((f) => ({ ...f, itemsText: e.target.value }))}
                placeholder="Items"
                rows={2}
                className="rounded-xl border border-ink-100 px-3 py-2 text-[14px]"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  value={form.amount || ''}
                  onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                  placeholder="Amount"
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
                <input
                  type="number"
                  value={form.deliveryFee || ''}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryFee: Number(e.target.value) }))}
                  placeholder="Delivery fee"
                  className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] sm:w-auto"
                />
              </div>
              <input
                value={form.paymentMethod}
                onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                placeholder="Payment method (Cash, Transfer…)"
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Note (optional)"
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
              <label className="flex items-center gap-2 text-[14px] text-ink-700">
                <input
                  type="checkbox"
                  checked={form.paid}
                  onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
                  className="h-5 w-5 accent-brand-500"
                />
                Paid
              </label>
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
            <h3 className="text-lg font-semibold text-ink-800">Delete this record?</h3>
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
    </div>
  )
}
