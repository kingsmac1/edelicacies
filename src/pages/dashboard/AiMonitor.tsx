import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  countSince,
  deleteGaps,
  fetchBudget,
  fetchChatsSince,
  fetchGaps,
  fetchUsageSince,
  markGapsDone,
  type AiBudget,
  type ChatStartRow,
  type GapRow,
  type UsageRow,
} from '../../lib/api/aiUsage'

type Range = 'today' | 'yesterday' | 'week'

const SLOW_MS = 10_000

// "2026-10-13" for a timestamp, as a Nigerian calendar day.
function lagosDay(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(iso))
}

function dayOffset(offset: number): string {
  return lagosDay(new Date(Date.now() + offset * 86_400_000))
}

function Stat({ label, value, hint, tone = 'normal' }: { label: string; value: string; hint?: string; tone?: 'normal' | 'bad' | 'good' }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p
        className={`mt-1 text-[24px] font-bold ${
          tone === 'bad' ? 'text-brand-600' : tone === 'good' ? 'text-emerald-600' : 'text-ink-800'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[12px] text-ink-400">{hint}</p>}
    </div>
  )
}

export function OwnerAiMonitor() {
  const [range, setRange] = useState<Range>('yesterday')
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [chats, setChats] = useState<ChatStartRow[]>([])
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [budget, setBudget] = useState<AiBudget>({ usd: 1, max_calls: 400 })
  const [chatOrders, setChatOrders] = useState(0)
  const [enquiries, setEnquiries] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const since = new Date(Date.now() - 9 * 86_400_000).toISOString()
    Promise.all([
      fetchUsageSince(since),
      fetchChatsSince(since),
      fetchGaps(),
      fetchBudget(),
      countSince('orders', since, true),
      countSince('enquiries', since),
    ])
      .then(([u, c, g, b, o, e]) => {
        setUsage(u)
        setChats(c)
        setGaps(g)
        setBudget(b)
        setChatOrders(o)
        setEnquiries(e)
      })
      .catch(() => setError('Could not load the numbers. Please refresh.'))
      .finally(() => setLoading(false))
  }, [])

  const days = useMemo(() => {
    if (range === 'today') return new Set([dayOffset(0)])
    if (range === 'yesterday') return new Set([dayOffset(-1)])
    return new Set(Array.from({ length: 7 }, (_, i) => dayOffset(-i)))
  }, [range])

  const inRange = (iso: string) => days.has(lagosDay(iso))
  const rangeUsage = usage.filter((u) => u.kind === 'chat' && inRange(u.created_at))
  const good = rangeUsage.filter((u) => u.ok)
  const failed = rangeUsage.filter((u) => !u.ok)
  const cost = good.reduce((n, u) => n + (Number(u.cost) || 0), 0)
  const tokens = good.reduce((n, u) => n + u.total_tokens, 0)
  const times = good.map((u) => u.latency_ms ?? 0).filter((n) => n > 0)
  const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0
  const slow = good.filter((u) => (u.latency_ms ?? 0) >= SLOW_MS).slice(0, 8)
  const rangeChats = chats.filter((c) => inRange(c.created_at))
  const handedOff = rangeChats.filter((c) => c.ever_handed_off).length

  // Today's allowance (always today, whatever range is showing).
  const todayUsage = usage.filter((u) => u.kind === 'chat' && lagosDay(u.created_at) === dayOffset(0))
  const todayCost = todayUsage.reduce((n, u) => n + (Number(u.cost) || 0), 0)
  const stoppedToday = usage.some((u) => u.kind === 'budget_stop' && lagosDay(u.created_at) === dayOffset(0))

  // Saved gaps (kept for days, independent of the Today/Yesterday tabs).
  // The same question asked several times shows once, with a count.
  const groupedGaps = useMemo(() => {
    const groups = new Map<string, { key: string; question: string; count: number; ids: number[]; latest: GapRow }>()
    for (const g of gaps.filter((x) => x.status === 'open')) {
      const key = g.question.trim().toLowerCase().replace(/\s+/g, ' ')
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        existing.ids.push(g.id)
      } else {
        groups.set(key, { key, question: g.question, count: 1, ids: [g.id], latest: g })
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || (a.latest.created_at < b.latest.created_at ? 1 : -1))
  }, [gaps])

  async function removeGaps(ids: number[], mode: 'done' | 'delete') {
    setGaps((prev) => prev.filter((g) => !ids.includes(g.id)))
    try {
      if (mode === 'done') await markGapsDone(ids)
      else await deleteGaps(ids)
    } catch {
      setError('Could not update that list. Please refresh.')
      setGaps(await fetchGaps())
    }
  }

  function daysLeft(iso: string): number {
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
  }

  const label = range === 'today' ? 'Today' : range === 'yesterday' ? 'Yesterday' : 'Last 7 days'
  const pctCalls = Math.min(100, Math.round((todayUsage.length / budget.max_calls) * 100))
  const pctCost = Math.min(100, Math.round((todayCost / budget.usd) * 100))

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-ink-800">AI Monitor</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        What the assistant did, what it cost, and where it needs help.
      </p>

      <div className="mt-4 flex gap-2">
        {(
          [
            ['today', 'Today'],
            ['yesterday', 'Yesterday'],
            ['week', 'Last 7 days'],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            onClick={() => setRange(value)}
            className={`min-h-10 rounded-full px-4 text-[13px] font-semibold ${
              range === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-[14px] font-medium text-brand-600">{error}</p>}

      {loading ? (
        <p className="mt-10 text-center text-[14px] text-ink-400">Loading…</p>
      ) : (
        <>
          <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-ink-800">Today's allowance</p>
              {stoppedToday && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
                  Paused: limit reached
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[12px] text-ink-500">
                  Answers: {todayUsage.length} of {budget.max_calls}
                </p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pctCalls}%` }} />
                </div>
              </div>
              <div>
                <p className="text-[12px] text-ink-500">
                  Spend: ${todayCost.toFixed(4)} of ${budget.usd.toFixed(2)}
                </p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pctCost}%` }} />
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-ink-400">
              When either limit is reached the assistant pauses until tomorrow and sends customers to WhatsApp. Change
              the limits in the <code>ai_daily_budget</code> setting.
            </p>
          </div>

          <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-ink-400">{label}</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="AI answers" value={String(good.length)} />
            <Stat label="Cost" value={`$${cost.toFixed(4)}`} hint="Free models cost $0" />
            <Stat label="Tokens used" value={tokens.toLocaleString('en-NG')} />
            <Stat label="Avg reply time" value={avgMs ? `${(avgMs / 1000).toFixed(1)} s` : '-'} tone={avgMs > SLOW_MS ? 'bad' : 'normal'} />
            <Stat label="Errors" value={String(failed.length)} tone={failed.length > 0 ? 'bad' : 'good'} />
            <Stat label="Chats started" value={String(rangeChats.length)} />
            <Stat label="Handed to you" value={String(handedOff)} hint="by the automatic rules" />
            <Stat label="Orders via chat" value={String(chatOrders)} hint="last 9 days" />
            <Stat label="Left for the team" value={String(enquiries)} hint="enquiries, last 9 days" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-ink-800">Questions it couldn't answer</h3>
                  <p className="mt-0.5 text-[12px] text-ink-400">
                    Kept for 14 days, then they remove themselves. Add a note for the common ones.
                  </p>
                </div>
                {groupedGaps.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Remove every question from this list?')) {
                        void removeGaps(groupedGaps.flatMap((g) => g.ids), 'delete')
                      }
                    }}
                    className="shrink-0 text-[12px] font-medium text-ink-400 underline hover:text-brand-600"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {groupedGaps.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-400">Nothing waiting. Great.</p>
              ) : (
                <ul className="mt-3 flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
                  {groupedGaps.map((g) => (
                    <li key={g.key} className="rounded-xl bg-ink-50 p-3 text-[13px] text-ink-700">
                      <p>
                        "{g.question.slice(0, 160)}"
                        {g.count > 1 && (
                          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                            asked {g.count} times
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-400">
                        {new Date(g.latest.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' · '}removes itself in {daysLeft(g.latest.expires_at)} days
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-semibold">
                        {g.latest.conversation_id && (
                          <Link to={`/dashboard/inbox?c=${g.latest.conversation_id}`} className="text-brand-600">
                            Open chat
                          </Link>
                        )}
                        <button className="text-emerald-700" onClick={() => void removeGaps(g.ids, 'done')}>
                          I added a note
                        </button>
                        <button className="text-ink-400 hover:text-brand-600" onClick={() => void removeGaps(g.ids, 'delete')}>
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
              <h3 className="text-[14px] font-semibold text-ink-800">Problems and slow replies</h3>
              {failed.length === 0 && slow.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-400">Nothing wrong in this period.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {failed.slice(0, 8).map((u) => (
                    <li key={u.id} className="rounded-xl bg-brand-50 p-2.5 text-[13px] text-brand-800">
                      <strong>Failed</strong> · {new Date(u.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      <br />
                      {u.error}
                    </li>
                  ))}
                  {slow.map((u) => (
                    <li key={u.id} className="rounded-xl bg-amber-50 p-2.5 text-[13px] text-amber-800">
                      <strong>Slow</strong> · {((u.latency_ms ?? 0) / 1000).toFixed(1)} s
                      {u.model ? ` · ${u.model.split('/').pop()}` : ''}
                      {u.conversation_id && (
                        <Link to={`/dashboard/inbox?c=${u.conversation_id}`} className="ml-2 font-semibold underline">
                          open chat
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
