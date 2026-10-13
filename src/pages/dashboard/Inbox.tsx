import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  fetchConversations,
  fetchThread,
  markConversationRead,
  sendOwnerReply,
  setConversationMode,
  type ConversationRow,
  type ThreadMessage,
} from '../../lib/api/inbox'
import { Button } from '../../components/ui/Button'

const LIST_POLL_MS = 5000
const THREAD_POLL_MS = 4000

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function OwnerInbox() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('c')
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'all' | 'needs' | 'ai'>('all')
  const bottomRef = useRef<HTMLDivElement>(null)

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  const loadList = useCallback(async () => {
    try {
      setConversations(await fetchConversations())
      setError(null)
    } catch {
      setError('Could not load your chats. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadThread = useCallback(async (id: string) => {
    try {
      setThread(await fetchThread(id))
    } catch {
      /* the next poll will try again */
    }
  }, [])

  useEffect(() => {
    void loadList()
    const id = window.setInterval(() => void loadList(), LIST_POLL_MS)
    return () => window.clearInterval(id)
  }, [loadList])

  // Open a chat: load it, mark it read, keep it fresh.
  useEffect(() => {
    if (!selectedId) {
      setThread([])
      return
    }
    void loadThread(selectedId)
    void markConversationRead(selectedId).then(() => loadList()).catch(() => undefined)
    const id = window.setInterval(() => void loadThread(selectedId), THREAD_POLL_MS)
    return () => window.clearInterval(id)
  }, [selectedId, loadThread, loadList])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length, selectedId])

  async function handleTakeOver() {
    if (!selectedId) return
    setBusy(true)
    try {
      await setConversationMode(selectedId, 'owner')
      await Promise.all([loadThread(selectedId), loadList()])
    } catch {
      setError('Could not take over this chat.')
    } finally {
      setBusy(false)
    }
  }

  async function handleHandBack() {
    if (!selectedId) return
    setBusy(true)
    try {
      await setConversationMode(selectedId, 'ai')
      await Promise.all([loadThread(selectedId), loadList()])
    } catch {
      setError('Could not hand this chat back.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !selectedId || busy) return
    setBusy(true)
    try {
      await sendOwnerReply(selectedId, text)
      setDraft('')
      await Promise.all([loadThread(selectedId), loadList()])
    } catch {
      setError('Could not send your reply. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const visible = conversations.filter((c) =>
    filter === 'all' ? true : filter === 'needs' ? c.mode === 'owner' || c.owner_unread : c.mode === 'ai',
  )
  const needsCount = conversations.filter((c) => c.mode === 'owner' || c.owner_unread).length

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Inbox</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        Live chats from the website. Take over any chat and the assistant goes quiet until you hand it back.
      </p>
      {error && <p className="mt-3 text-[14px] font-medium text-brand-600">{error}</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Conversation list (hidden on phones while a chat is open) */}
        <div className={`${selectedId ? 'hidden md:block' : ''}`}>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ['all', `All (${conversations.length})`],
                ['needs', `Needs you (${needsCount})`],
                ['ai', 'Assistant'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${
                  filter === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-8 text-center text-[14px] text-ink-400">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-[14px] text-ink-400 ring-1 ring-ink-100">
              {filter === 'needs' ? 'Nothing needs you right now.' : 'No chats yet. They appear here as customers write.'}
            </p>
          ) : (
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
              {visible.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setParams({ c: c.id })}
                  className={`rounded-2xl p-3 text-left ring-1 ${
                    c.id === selectedId ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-ink-100 hover:bg-ink-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-ink-800">
                      {c.owner_unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />}
                      <span className="truncate">{c.customer_name ?? 'Website visitor'}</span>
                    </p>
                    <span className="shrink-0 text-[11px] text-ink-400">{timeLabel(c.last_message_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-500">{c.last_preview ?? '…'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        c.mode === 'owner' ? 'bg-brand-50 text-brand-700' : 'bg-ink-50 text-ink-500'
                      }`}
                    >
                      {c.mode === 'owner' ? 'You' : 'Assistant'}
                    </span>
                    {c.mode === 'owner' && c.handoff_reason && (
                      <span className="truncate text-[11px] text-ink-400">{c.handoff_reason}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The open conversation */}
        <div className={`${selectedId ? '' : 'hidden md:block'}`}>
          {!selected ? (
            <div className="rounded-2xl bg-white p-10 text-center text-[14px] text-ink-400 ring-1 ring-ink-100">
              Choose a chat to read it.
            </div>
          ) : (
            <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
                <div className="min-w-0">
                  <button
                    onClick={() => setParams({})}
                    className="mb-0.5 text-[12px] font-semibold text-brand-600 md:hidden"
                  >
                    ← All chats
                  </button>
                  <p className="truncate text-[15px] font-semibold text-ink-800">
                    {selected.customer_name ?? 'Website visitor'}
                  </p>
                  {selected.customer_contact && (
                    <p className="truncate text-[12px] text-ink-400">{selected.customer_contact}</p>
                  )}
                </div>
                {selected.mode === 'owner' ? (
                  <Button variant="secondary" onClick={() => void handleHandBack()} disabled={busy}>
                    Hand back to AI
                  </Button>
                ) : (
                  <Button onClick={() => void handleTakeOver()} disabled={busy}>
                    Take over
                  </Button>
                )}
              </div>

              <div
                className={`px-4 py-2 text-[12px] font-medium ${
                  selected.mode === 'owner' ? 'bg-brand-50 text-brand-700' : 'bg-ink-50 text-ink-500'
                }`}
              >
                {selected.mode === 'owner'
                  ? 'You are in control. The assistant will not reply to this customer.'
                  : 'The assistant is answering this chat. Take over, or just send a reply to join in.'}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto bg-cream-50 p-4">
                {thread.map((m) =>
                  m.role === 'system' ? (
                    <p key={m.id} className="text-center text-[12px] italic text-ink-400">
                      {m.content}
                    </p>
                  ) : (
                    <div key={m.id} className={m.role === 'owner' ? 'flex justify-end' : 'flex justify-start'}>
                      <div className="max-w-[80%]">
                        <p className="mb-0.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                          {m.role === 'user' ? 'Customer' : m.role === 'assistant' ? 'Assistant' : 'You'} ·{' '}
                          {timeLabel(m.created_at)}
                        </p>
                        <p
                          className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-[14px] ${
                            m.role === 'owner'
                              ? 'bg-brand-500 text-white'
                              : m.role === 'assistant'
                                ? 'bg-ink-100 text-ink-700'
                                : 'bg-white text-ink-800 ring-1 ring-ink-100'
                          }`}
                        >
                          {m.content}
                        </p>
                      </div>
                    </div>
                  ),
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="flex gap-2 border-t border-ink-100 p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={selected.mode === 'owner' ? 'Type your reply…' : 'Reply (this will take over the chat)…'}
                  maxLength={2000}
                  className="min-h-11 min-w-0 flex-1 rounded-full border border-ink-200 px-4 text-[14px] outline-none focus:border-brand-500"
                />
                <Button type="submit" disabled={busy || !draft.trim()}>
                  Send
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
