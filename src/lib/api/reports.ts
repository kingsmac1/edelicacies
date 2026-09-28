import { supabase } from '../supabase'

export interface BestSellerRow {
  name: string
  quantity: number
  amount: number
}

const COMMITTED_STATUSES = new Set([
  'paid',
  'preparing',
  'out_for_delivery',
  'ready_for_pickup',
  'delivered',
])

export async function fetchBestSellers(startDate: string, endDate: string): Promise<BestSellerRow[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('item_name, variation_label, unit_price, quantity, menu_date, orders!inner(status)')
    .gte('menu_date', startDate)
    .lte('menu_date', endDate)
  if (error) throw error

  const map = new Map<string, BestSellerRow>()
  for (const row of (data ?? []) as unknown as Array<{
    item_name: string
    variation_label: string
    unit_price: number
    quantity: number
    orders: { status: string } | { status: string }[] | null
  }>) {
    const orderRel = Array.isArray(row.orders) ? row.orders[0] : row.orders
    if (!orderRel || !COMMITTED_STATUSES.has(orderRel.status)) continue
    const key = `${row.item_name} (${row.variation_label})`
    const existing = map.get(key) ?? { name: key, quantity: 0, amount: 0 }
    existing.quantity += row.quantity
    existing.amount += row.quantity * row.unit_price
    map.set(key, existing)
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity)
}

export interface DailyTotals {
  date: string
  sales: number
  expenses: number
}

export async function fetchSalesVsExpenses(startDate: string, endDate: string): Promise<DailyTotals[]> {
  const [ordersRes, manualRes, expensesRes] = await Promise.all([
    supabase
      .from('orders')
      .select('menu_date, total, status')
      .gte('menu_date', startDate)
      .lte('menu_date', endDate),
    supabase
      .from('manual_sales')
      .select('sale_date, amount, delivery_fee')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate),
    supabase
      .from('expenses')
      .select('expense_date, amount')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate),
  ])
  if (ordersRes.error) throw ordersRes.error
  if (manualRes.error) throw manualRes.error
  if (expensesRes.error) throw expensesRes.error

  const byDate = new Map<string, DailyTotals>()
  const ensure = (date: string) => {
    let entry = byDate.get(date)
    if (!entry) {
      entry = { date, sales: 0, expenses: 0 }
      byDate.set(date, entry)
    }
    return entry
  }

  for (const o of ordersRes.data ?? []) {
    if (!COMMITTED_STATUSES.has(o.status)) continue
    ensure(o.menu_date).sales += o.total
  }
  for (const m of manualRes.data ?? []) {
    ensure(m.sale_date).sales += m.amount + m.delivery_fee
  }
  for (const e of expensesRes.data ?? []) {
    ensure(e.expense_date).expenses += e.amount
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function toCsv(rows: Record<string, string | number>[], columns: { key: string; label: string }[]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','))
  return [header, ...lines].join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
