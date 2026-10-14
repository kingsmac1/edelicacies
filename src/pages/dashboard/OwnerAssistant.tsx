import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import {
  askOwnerAssistant,
  clearOwnerChat,
  loadOwnerChat,
  saveOwnerChatMessage,
  type StoredOwnerMessage,
} from '../../lib/api/ownerAssistant'

// A proposal expires on the server after 5 minutes, so its buttons do too.
const PROPOSAL_MS = 5 * 60 * 1000

const SUGGESTIONS = [
  'How many orders do we have today?',
  'How much have we sold today?',
  'How much did we sell yesterday?',
  "What's our best-selling item this week?",
  "Show today's orders",
  'Which orders are waiting for my approval today?',
  'Mark Jollof Rice as sold out',
  'Set Jollof Rice to 5 portions left',
  'Change the price of Jollof Rice (Regular) to ₦3,000',
  'Add a phone order for Chidi, 08031234567: 2 Jollof Rice (Regular), pickup, paid by transfer',
  'Undo the last change',
  'Which chats need me?',
  "Take over Chidi's chat",
  "What's on today's menu?",
  'Add Atama Soup to today\'s menu with 5 portions',
]

export function OwnerAssistantPage() {
  const [messages, setMessages] = useState<StoredOwnerMessage[]>([])
  const [restoring, setRestoring] = useState(true)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [params, setParams] = useSearchParams()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Bring back the saved conversation on every visit or refresh.
  useEffect(() => {
    let cancelled = false
    loadOwnerChat()
      .then((rows) => {
        if (!cancelled) setMessages(rows)
      })
      .catch(() => undefined) // before the SQL is run the chat simply starts empty
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // A link like /dashboard/assistant?say=Undo the last change fills the box
  // (it never sends by itself: you read it, then press Ask).
  useEffect(() => {
    const say = params.get('say')
    if (say) {
      setInput(say.slice(0, 500))
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return
    const next: StoredOwnerMessage[] = [...messages, { role: 'user', content, at: new Date().toISOString() }]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)
    void saveOwnerChatMessage('user', content)
    try {
      const { reply } = await askOwnerAssistant(next.map(({ role, content: c }) => ({ role, content: c })))
      setMessages([...next, { role: 'assistant', content: reply, at: new Date().toISOString() }])
      void saveOwnerChatMessage('assistant', reply)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const last = messages[messages.length - 1]
  const fresh = last ? Date.now() - new Date(last.at).getTime() < PROPOSAL_MS : false
  const waitingForPin =
    !loading && last?.role === 'assistant' && fresh && /(Enter your PIN|needs your PIN|That PIN is not right)/.test(last.content)
  const waitingForYes = !loading && last?.role === 'assistant' && fresh && /Reply YES to confirm/.test(last.content)

  // The PIN goes in its own hidden field. What is saved in the conversation is
  // only a masked placeholder, never the digits.
  async function sendPin() {
    const digits = pin.trim()
    if (!/^\d{4,6}$/.test(digits) || loading) return
    const shown: StoredOwnerMessage = { role: 'user', content: '••••', at: new Date().toISOString() }
    const next = [...messages, shown]
    setMessages(next)
    setPin('')
    setError(null)
    setLoading(true)
    void saveOwnerChatMessage('user', '••••')
    try {
      const { reply } = await askOwnerAssistant(
        next.map(({ role, content: c }) => ({ role, content: c === '••••' ? '(PIN entered)' : c })),
        digits,
      )
      setMessages([...next, { role: 'assistant', content: reply, at: new Date().toISOString() }])
      void saveOwnerChatMessage('assistant', reply)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function startAgain() {
    if (!window.confirm('Clear this conversation? Your records and the admin log are not affected.')) return
    try {
      await clearOwnerChat()
      setMessages([])
      setError(null)
    } catch {
      setError('Could not clear the conversation. Please try again.')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-800">Owner assistant</h1>
        {messages.length > 0 && (
          <button
            onClick={() => void startAgain()}
            className="shrink-0 text-[13px] font-medium text-ink-400 underline hover:text-brand-600"
          >
            Clear conversation
          </button>
        )}
      </div>
      <p className="mt-1 text-[14px] text-ink-400">
        Ask about your orders and sales. The numbers come straight from your records, never from the assistant's
        guess, and match your Finances page. It can also prepare changes (mark an item sold out, set portions left, approve or reject an
        order, change prices, add a phone order), but nothing happens until you confirm, and bigger changes need your PIN.
      </p>

      <div className="mt-4 flex h-[65vh] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
        <div className="flex-1 space-y-3 overflow-y-auto bg-cream-50 p-4">
          {restoring && <p className="text-[13px] text-ink-400">Loading your conversation…</p>}
          {!restoring && messages.length === 0 && (
            <div>
              <p className="text-[14px] text-ink-500">Try one of these:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="min-h-10 rounded-full bg-white px-3.5 text-left text-[13px] font-semibold text-ink-700 ring-1 ring-ink-100 hover:bg-ink-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] ${
                  m.role === 'user' ? 'bg-ink-900 text-white' : 'bg-white text-ink-800 ring-1 ring-ink-100'
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <p className="rounded-2xl bg-white px-3.5 py-2.5 text-[14px] text-ink-400 ring-1 ring-ink-100">
                Checking your records…
              </p>
            </div>
          )}
          {waitingForPin && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void sendPin()
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN"
                aria-label="Your PIN"
                className="min-h-11 w-32 rounded-xl border border-ink-200 px-3 text-center text-[16px] tracking-[0.4em] outline-none focus:border-brand-500"
              />
              <Button type="submit" disabled={!/^\d{4,6}$/.test(pin)}>
                Confirm with PIN
              </Button>
              <Button type="button" variant="secondary" onClick={() => void send('NO')}>
                No, cancel
              </Button>
            </form>
          )}
          {waitingForYes && (
            <div className="flex gap-2">
              <Button onClick={() => void send('YES')}>Yes, do it</Button>
              <Button variant="secondary" onClick={() => void send('NO')}>
                No, cancel
              </Button>
            </div>
          )}
          {error && <p className="text-center text-[13px] font-medium text-brand-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
          className="flex gap-2 border-t border-ink-100 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about orders or sales…"
            maxLength={500}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-ink-200 px-4 text-[14px] outline-none focus:border-brand-500"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            Ask
          </Button>
        </form>
      </div>
    </div>
  )
}
