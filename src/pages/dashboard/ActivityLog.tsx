import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminLog, type AdminLogRow } from '../../lib/api/ownerNumbers'
import { Button } from '../../components/ui/Button'

const PAGE = 40

type Group = 'all' | 'prices' | 'menu' | 'orders' | 'chats' | 'security'

const GROUPS: { id: Group; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'prices', label: 'Prices' },
  { id: 'menu', label: 'Menu & portions' },
  { id: 'orders', label: 'Orders' },
  { id: 'chats', label: 'Chats' },
  { id: 'security', label: 'Numbers & PIN' },
]

function groupOf(action: string): Group {
  if (action.endsWith('set_price') || action.endsWith('set_prices')) return 'prices'
  if (/(set_sold_out|set_available|set_portions|add_to_menu|remove_from_menu)$/.test(action)) return 'menu'
  if (/(take_over_chat|hand_back_chat)$/.test(action)) return 'chats'
  if (/(add_order|approve_order|reject_order)$/.test(action)) return 'orders'
  return 'security'
}

const LABEL: Record<string, string> = {
  'owner_action.set_price': 'Price changed',
  'owner_action.set_prices': 'Prices changed',
  'owner_action.set_sold_out': 'Marked sold out',
  'owner_action.set_available': 'Made available again',
  'owner_action.set_portions': 'Portions set',
  'owner_action.add_order': 'Phone order added',
  'owner_action.add_to_menu': 'Added to the menu',
  'owner_action.remove_from_menu': 'Removed from the menu',
  'owner_action.take_over_chat': 'Chat taken over',
  'owner_action.hand_back_chat': 'Chat handed back to the assistant',
  'owner_action.approve_order': 'Order approved',
  'owner_action.reject_order': 'Order rejected or cancelled',
  'owner_number.add': 'Owner number added',
  'owner_number.rename': 'Owner number renamed',
  'owner_number.remove': 'Owner number removed',
  'owner_number.verify': 'Owner number confirmed',
  'owner_security.set_pin': 'PIN set or changed',
}

const naira = (n: unknown) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG')

interface Line {
  text: string
}

// A readable "before → after" for the kinds of change that have one.
function detailLines(r: AdminLogRow): Line[] {
  const b = r.before_value as Record<string, unknown> | null | undefined
  const a = r.after_value as Record<string, unknown> | null | undefined
  const out: Line[] = []
  const bp = (b?.prices as { variation_id: string; item: string; label: string; price: number }[] | undefined) ?? []
  const ap = (a?.prices as { variation_id: string; price: number }[] | undefined) ?? []
  for (const old of bp) {
    const now = ap.find((x) => x.variation_id === old.variation_id)
    out.push({ text: `${old.item} (${old.label}): ${naira(old.price)} → ${naira(now?.price)}` })
  }
  const bs = (b?.slots as { slot_id: string; item: string; label: string; slots_left: number }[] | undefined) ?? []
  const as = (a?.slots as { slot_id: string; slots_left: number }[] | undefined) ?? []
  for (const old of bs) {
    const now = as.find((x) => x.slot_id === old.slot_id)
    out.push({ text: `${old.item} (${old.label}): ${old.slots_left} left → ${now?.slots_left ?? '?'} left` })
  }
  if (/(take_over_chat|hand_back_chat)$/.test(r.action) && b && a) {
    out.push({ text: `${String(a.chat)}: ${String(b.mode) === 'owner' ? 'you' : 'assistant'} → ${String(a.mode) === 'owner' ? 'you' : 'assistant'}` })
  }
  if (r.action === 'owner_action.add_order' && a) {
    out.push({
      text: `Order ${String(a.order_number)} · ${naira(a.total)} · ${a.paid ? 'paid' : 'not yet paid'}`,
    })
  }
  if ((r.action === 'owner_action.approve_order' || r.action === 'owner_action.reject_order') && b && a) {
    out.push({ text: `${String(b.order_number)}: ${String(b.status).replace(/_/g, ' ')} → ${String(a.status).replace(/_/g, ' ')}` })
  }
  return out
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function OwnerActivityLog() {
  const [rows, setRows] = useState<AdminLogRow[]>([])
  const [group, setGroup] = useState<Group>('all')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminLog(PAGE)
      setRows(data)
      setMore(data.length === PAGE)
      setError(null)
    } catch {
      setError('Could not load the activity log. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function loadMore() {
    const last = rows[rows.length - 1]
    if (!last) return
    try {
      const data = await fetchAdminLog(PAGE, last.id)
      setRows((r) => [...r, ...data])
      setMore(data.length === PAGE)
    } catch {
      setError('Could not load more.')
    }
  }

  const shown = rows.filter((r) => group === 'all' || groupOf(r.action) === group)
  // Only the newest price or portions change can be undone safely.
  const undoable = rows.find((r) => /owner_action\.(set_price|set_prices|set_sold_out|set_available|set_portions)$/.test(r.action))

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Activity log</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        Every change made through the owner assistant, with who did it, when, and the value before and after, so any
        mistake can be traced and put back.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${
              group === g.id ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-[14px] font-medium text-brand-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-[14px] text-ink-400">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-6 text-center text-[14px] text-ink-400 ring-1 ring-ink-100">
          Nothing here yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {shown.map((r) => {
            const details = detailLines(r)
            return (
              <li key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-ink-800">{LABEL[r.action] ?? r.action}</p>
                  <span className="text-[12px] text-ink-400">{when(r.created_at)}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-600">{r.summary}</p>
                {details.length > 0 && (
                  <ul className="mt-2 space-y-0.5 rounded-xl bg-ink-50 p-2.5 text-[12px] text-ink-700">
                    {details.slice(0, 12).map((d, i) => (
                      <li key={i}>{d.text}</li>
                    ))}
                    {details.length > 12 && <li className="text-ink-400">and {details.length - 12} more</li>}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-ink-400">{r.actor}</p>
                  {undoable?.id === r.id && (
                    <Link
                      to={`/dashboard/assistant?say=${encodeURIComponent('Undo the last change')}`}
                      className="text-[12px] font-semibold text-brand-600 underline"
                    >
                      Undo this…
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {more && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => void loadMore()}>
            Show older
          </Button>
        </div>
      )}
    </div>
  )
}
