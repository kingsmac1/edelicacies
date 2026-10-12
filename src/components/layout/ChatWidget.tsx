import { useEffect, useRef, useState } from 'react'
import { sendChat, type ChatMessage } from '../../lib/chat'

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm the Edelicacies assistant. Ask me anything about our food.",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      // The greeting is our own text, not something the customer said, so we
      // don't send it to the AI.
      const { reply, usage } = await sendChat(next.slice(1))
      if (usage) console.log('tokens used:', usage)
      setMessages([...next, { role: 'assistant', content: reply.trim() }])
    } catch (err) {
      console.error('chat failed', err)
      setError("Sorry, I couldn't reply just now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-40 right-4 z-50 flex h-[28rem] max-h-[calc(100vh-11rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/25 ring-1 ring-black/10">
          <div className="flex items-center justify-between bg-ink-900 px-4 py-3 text-white">
            <div>
              <p className="font-display text-base font-semibold">Edelicacies assistant</p>
              <p className="text-xs text-ink-200">Ask about our food</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-white/10"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-cream-50 p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <p
                  className={
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ' +
                    (m.role === 'user'
                      ? 'bg-brand-500 text-white'
                      : 'bg-white text-ink-800 ring-1 ring-ink-100')
                  }
                >
                  {m.content}
                </p>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <p className="rounded-2xl bg-white px-3 py-2 text-sm text-ink-400 ring-1 ring-ink-100">
                  Typing…
                </p>
              </div>
            )}
            {error && <p className="text-center text-xs text-brand-700">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-ink-100 bg-white p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              maxLength={500}
              className="min-w-0 flex-1 rounded-full border border-ink-200 px-4 py-2 text-sm outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-black/20 active:scale-95"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H8l-4.5 4a.5.5 0 01-.83-.37V5a2 2 0 011.33-2z" />
        </svg>
      </button>
    </>
  )
}
