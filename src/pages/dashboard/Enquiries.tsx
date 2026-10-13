import { useEffect, useState } from 'react'
import {
  deleteEnquiry,
  fetchEnquiries,
  phoneToWhatsAppNumber,
  setEnquiryStatus,
  type EnquiryRow,
  type EnquiryStatus,
} from '../../lib/api/enquiries'

type Filter = 'open' | 'all' | 'resolved'

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  resolved: 'Resolved',
}

const STATUS_STYLE: Record<EnquiryStatus, string> = {
  new: 'bg-brand-50 text-brand-700',
  contacted: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
}

export function OwnerEnquiries() {
  const [rows, setRows] = useState<EnquiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [openChat, setOpenChat] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRows(await fetchEnquiries())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load enquiries.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function changeStatus(id: string, status: EnquiryStatus) {
    const previous = rows
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await setEnquiryStatus(id, status)
    } catch {
      setRows(previous)
      setError('Could not update that enquiry. Please try again.')
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this enquiry for good?')) return
    try {
      await deleteEnquiry(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setError('Could not delete that enquiry.')
    }
  }

  const openCount = rows.filter((r) => r.status !== 'resolved').length
  const list = rows.filter((r) =>
    filter === 'all' ? true : filter === 'resolved' ? r.status === 'resolved' : r.status !== 'resolved',
  )

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-ink-800">Enquiries</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        Questions the chat assistant couldn't answer, left by customers for you to follow up.
      </p>

      {error && <p className="mt-3 text-[14px] font-medium text-brand-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ['open', `To follow up (${openCount})`],
            ['resolved', 'Resolved'],
            ['all', `All (${rows.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`min-h-10 rounded-full px-4 text-[13px] font-semibold ${
              filter === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">
          {filter === 'open' ? 'Nothing to follow up. You are all caught up.' : 'No enquiries here.'}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {list.map((r) => {
            const wa = phoneToWhatsAppNumber(r.contact)
            const isEmail = r.contact.includes('@')
            return (
              <div key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink-800">{r.name}</p>
                    <p className="text-[13px] text-ink-500">{r.contact}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className="text-[12px] text-ink-400">
                      {new Date(r.created_at).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <p className="mt-3 rounded-xl bg-ink-50 p-3 text-[14px] text-ink-700">{r.message}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => r.status === 'new' && void changeStatus(r.id, 'contacted')}
                      className="min-h-10 rounded-full bg-[#25D366] px-4 py-2.5 text-[13px] font-semibold text-white"
                    >
                      Reply on WhatsApp
                    </a>
                  )}
                  {isEmail && (
                    <a
                      href={`mailto:${r.contact}?subject=${encodeURIComponent('Your question to Edelicacies')}`}
                      onClick={() => r.status === 'new' && void changeStatus(r.id, 'contacted')}
                      className="min-h-10 rounded-full bg-ink-900 px-4 py-2.5 text-[13px] font-semibold text-white"
                    >
                      Reply by email
                    </a>
                  )}
                  <select
                    value={r.status}
                    onChange={(e) => void changeStatus(r.id, e.target.value as EnquiryStatus)}
                    className="min-h-10 rounded-full border border-ink-100 bg-white px-3 text-[13px] font-medium"
                    aria-label="Status"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  {r.conversation && (
                    <button
                      onClick={() => setOpenChat(openChat === r.id ? null : r.id)}
                      className="text-[13px] font-medium text-ink-500 underline"
                    >
                      {openChat === r.id ? 'Hide chat' : 'See the chat'}
                    </button>
                  )}
                  <button
                    onClick={() => void remove(r.id)}
                    className="ml-auto text-[12px] font-medium text-ink-400 hover:text-brand-600"
                  >
                    Delete
                  </button>
                </div>

                {openChat === r.id && r.conversation && (
                  <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-[12px] text-ink-600">
                    {r.conversation}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
