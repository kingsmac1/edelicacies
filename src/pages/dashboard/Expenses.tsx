import { useEffect, useMemo, useState } from 'react'
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
  type ExpenseInput,
} from '../../lib/api/expenses'
import { fetchManualSales, fetchOnlinePaidOrders } from '../../lib/api/records'
import { fetchSettings } from '../../lib/api/settings'
import { formatNaira, todayLagos } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { SuccessModal } from '../../components/ui/SuccessModal'
import type { ExpenseRow } from '../../types/db'

const emptyForm: ExpenseInput = { expenseDate: todayLagos(), category: 'Ingredients', amount: 0, note: '' }

export function OwnerExpenses() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [categories, setCategories] = useState<string[]>(['Ingredients', 'Gas', 'Packaging', 'Transport', 'Staff', 'Other'])
  const [salesTotal, setSalesTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState({ start: todayLagos().slice(0, 8) + '01', end: todayLagos() })
  const [editing, setEditing] = useState<ExpenseRow | 'new' | null>(null)
  const [form, setForm] = useState<ExpenseInput>(emptyForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [exp, manual, online, settings] = await Promise.all([
        fetchExpenses(),
        fetchManualSales(),
        fetchOnlinePaidOrders(),
        fetchSettings(),
      ])
      setExpenses(exp)
      setCategories(settings.expense_categories)
      const manualSum = manual
        .filter((m) => m.sale_date >= range.start && m.sale_date <= range.end)
        .reduce((sum, m) => sum + m.amount + m.delivery_fee, 0)
      const onlineSum = online
        .filter((o) => o.menu_date >= range.start && o.menu_date <= range.end)
        .reduce((sum, o) => sum + o.total, 0)
      setSalesTotal(manualSum + onlineSum)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

  const filtered = useMemo(
    () => expenses.filter((e) => e.expense_date >= range.start && e.expense_date <= range.end),
    [expenses, range],
  )
  const expenseTotal = filtered.reduce((sum, e) => sum + e.amount, 0)
  const profit = salesTotal - expenseTotal

  async function handleSave() {
    if (editing === 'new') await createExpense(form)
    else if (editing) await updateExpense(editing.id, form)
    setEditing(null)
    setShowSaveSuccess(true)
    await load()
  }

  async function handleDelete(id: string) {
    await deleteExpense(id)
    setDeletingId(null)
    await load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-800">Expenses</h1>
        <Button
          onClick={() => {
            setForm({ ...emptyForm, category: categories[0] ?? 'Other' })
            setEditing('new')
          }}
        >
          + Add expense
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="date"
          value={range.start}
          onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
          className="min-h-9 min-w-0 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
        <input
          type="date"
          value={range.end}
          onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
          className="min-h-9 min-w-0 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Sales', formatNaira(salesTotal)],
          ['Expenses', formatNaira(expenseTotal)],
          ['Profit', formatNaira(profit)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-3 text-center ring-1 ring-ink-100">
            <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
            <p className="mt-1 text-[15px] font-bold text-ink-800">{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">No expenses in this range.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink-100">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink-800">{e.category}</p>
                <p className="text-[12px] text-ink-400">
                  {e.expense_date}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </div>
              <span className="text-[14px] font-semibold text-ink-800">{formatNaira(e.amount)}</span>
              <div className="flex gap-2 text-[12px] font-semibold">
                <button
                  onClick={() => {
                    setForm({
                      expenseDate: e.expense_date,
                      category: e.category,
                      amount: e.amount,
                      note: e.note ?? '',
                    })
                    setEditing(e)
                  }}
                  className="text-brand-600"
                >
                  Edit
                </button>
                <button onClick={() => setDeletingId(e.id)} className="text-ink-400">
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
            <h2 className="text-lg font-semibold text-ink-800">{editing === 'new' ? 'Add expense' : 'Edit expense'}</h2>
            <div className="mt-4 flex flex-col gap-3">
              <input
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={form.amount || ''}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                placeholder="Amount"
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Note (optional)"
                className="min-h-11 rounded-xl border border-ink-100 px-3 text-[14px]"
              />
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
            <h3 className="text-lg font-semibold text-ink-800">Delete this expense?</h3>
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
        title="Expense saved!"
        onClose={() => setShowSaveSuccess(false)}
      />
    </div>
  )
}
