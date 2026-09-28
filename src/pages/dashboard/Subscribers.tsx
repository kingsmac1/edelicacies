import { useEffect, useState } from 'react'
import { deleteSubscriber, fetchSubscribers } from '../../lib/api/subscribers'
import { notifySubscribers } from '../../lib/edgeFunctions'
import { todayLagos } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import type { SubscriberRow } from '../../types/db'

export function OwnerSubscribers() {
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [notifyDate, setNotifyDate] = useState(todayLagos())
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setSubscribers(await fetchSubscribers())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleCopyNumbers() {
    const numbers = subscribers.map((s) => s.whatsapp).filter(Boolean).join(', ')
    await navigator.clipboard.writeText(numbers)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleNotify() {
    setNotifying(true)
    setNotifyResult(null)
    try {
      const result = await notifySubscribers(notifyDate)
      setNotifyResult(
        result ? `Sent to ${result.sent} of ${result.subscriberCount} subscribers.` : 'Could not send right now.',
      )
    } finally {
      setNotifying(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Subscribers</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-ink-100">
        <span className="text-[13px] font-medium text-ink-500">Notify subscribers about</span>
        <input
          type="date"
          value={notifyDate}
          onChange={(e) => setNotifyDate(e.target.value)}
          className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
        />
        <Button size="md" onClick={() => void handleNotify()} disabled={notifying}>
          {notifying ? 'Sending…' : 'Notify subscribers'}
        </Button>
        <Button size="md" variant="secondary" onClick={() => void handleCopyNumbers()}>
          {copied ? 'Copied!' : 'Copy all WhatsApp numbers'}
        </Button>
      </div>
      {notifyResult && <p className="mt-2 text-[13px] text-ink-500">{notifyResult}</p>}

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : subscribers.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">No subscribers yet.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {subscribers.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink-100">
              <div className="flex-1">
                <p className="text-[14px] font-medium text-ink-800">{s.name || 'Unnamed'}</p>
                <p className="text-[12px] text-ink-400">
                  {s.email}
                  {s.whatsapp ? ` · ${s.whatsapp}` : ''}
                </p>
              </div>
              <button
                onClick={() => deleteSubscriber(s.id).then(load)}
                className="text-[12px] font-semibold text-ink-400"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
