import { Link } from 'react-router-dom'
import heroDish from '../../assets/menu/native-rice-turkey-snails.jpg'
import logoWordmark from '../../assets/brand/logo-wordmark-white.png'
import { CartBubble } from './CartBubble'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChatNotFoundError,
  clearStoredChat,
  loadStoredChat,
  pollChat,
  saveStoredChat,
  sendChatMessage,
  type ChatMessageOut,
  type ChatMode,
  type SavedDetails,
  type StoredChat,
  forgetSavedDetails,
  loadSavedDetails,
  storeSavedDetails,
} from '../../lib/chat'

const POLL_MS = 5000

const GREETING = "Hi! I'm the Edelicacies assistant. Ask me anything about our food."

// A message waiting for the server's answer gets a negative temporary id.
type Shown = ChatMessageOut & { pending?: boolean }

// fullPage: the shareable /chat page. The chat fills the screen and the
// floating bubbles are not drawn.
export function ChatWidget({ fullPage = false }: { fullPage?: boolean }) {
  const [open, setOpen] = useState(fullPage)
  const [messages, setMessages] = useState<Shown[]>([])
  const [mode, setMode] = useState<ChatMode>('ai')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unseen, setUnseen] = useState(false)
  // Details from an order just placed, waiting for the customer's yes/no.
  const [offer, setOffer] = useState<SavedDetails | null>(null)
  const [hasSaved, setHasSaved] = useState(() => loadSavedDetails() !== null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<StoredChat | null>(null)
  const lastIdRef = useRef(0)
  const tempId = useRef(0)

  // Merge new server messages in, without ever showing one twice.
  const merge = useCallback((incoming: ChatMessageOut[]) => {
    if (incoming.length === 0) return
    setMessages((prev) => {
      const have = new Set(prev.filter((m) => !m.pending).map((m) => m.id))
      const fresh = incoming.filter((m) => !have.has(m.id))
      if (fresh.length === 0) return prev
      // A server copy of the customer's own message replaces its pending bubble.
      let next = prev
      for (const m of fresh) {
        if (m.role === 'user') {
          const idx = next.findIndex((p) => p.pending && p.content === m.content)
          if (idx >= 0) next = next.filter((_, i) => i !== idx)
        }
      }
      return [...next, ...fresh].sort((a, b) => (a.id < 0 || b.id < 0 ? 0 : a.id - b.id))
    })
    const maxId = Math.max(...incoming.map((m) => m.id))
    if (maxId > lastIdRef.current) lastIdRef.current = maxId
  }, [])

  const resetChat = useCallback(() => {
    clearStoredChat()
    chatRef.current = null
    lastIdRef.current = 0
    setMessages([])
    setMode('ai')
  }, [])

  // Load a chat that was started earlier in this browser.
  useEffect(() => {
    const stored = loadStoredChat()
    if (!stored) return
    chatRef.current = stored
    pollChat(stored, 0)
      .then((r) => {
        setMode(r.mode)
        merge(r.messages)
      })
      .catch((err) => {
        if (err instanceof ChatNotFoundError) resetChat()
      })
  }, [merge, resetChat])

  // While the chat is open, quietly check for replies from the team.
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => {
      const chat = chatRef.current
      if (!chat || document.hidden) return
      pollChat(chat, lastIdRef.current)
        .then((r) => {
          setMode(r.mode)
          merge(r.messages)
        })
        .catch((err) => {
          if (err instanceof ChatNotFoundError) resetChat()
        })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [open, merge, resetChat])

  // A reply that arrives while the window is closed gets a dot on the bubble.
  useEffect(() => {
    if (open) {
      setUnseen(false)
      return
    }
    const id = window.setInterval(() => {
      const chat = chatRef.current
      if (!chat || document.hidden) return
      pollChat(chat, lastIdRef.current)
        .then((r) => {
          if (r.messages.some((m) => m.role === 'owner' || m.role === 'assistant')) {
            setMode(r.mode)
            merge(r.messages)
            setUnseen(true)
          }
        })
        .catch(() => undefined)
    }, POLL_MS * 3)
    return () => window.clearInterval(id)
  }, [open, merge])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    void sendText(input.trim())
  }

  async function sendText(text: string) {
    if (!text || loading) return

    tempId.current -= 1
    setMessages((prev) => [
      ...prev,
      {
        id: tempId.current,
        role: 'user',
        content: text,
        meta: null,
        created_at: new Date().toISOString(),
        pending: true,
      },
    ])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const result = await sendChatMessage(text, chatRef.current)
      if (!chatRef.current && result.accessToken) {
        const created = {
          conversationId: result.conversationId,
          accessToken: result.accessToken,
        }
        chatRef.current = created
        saveStoredChat(created)
      }
      setMode(result.mode)
      merge(result.messages)
      const placed = result.messages.find((m) => m.meta?.orderDetails)?.meta?.orderDetails
      if (placed) {
        const old = loadSavedDetails()
        const same = old && JSON.stringify(old) === JSON.stringify(placed)
        if (!same) setOffer(placed)
      }
    } catch (err) {
      if (err instanceof ChatNotFoundError) {
        // The saved chat is gone: start fresh next time.
        resetChat()
        setError('That chat has ended. Please send your message again.')
      } else {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Sorry, I couldn't reply just now. Please try again.",
        )
      }
      setMessages((prev) => prev.filter((m) => !m.pending))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const header = (
    <div
      className={`relative overflow-hidden bg-ink-900 text-white ${
        fullPage ? 'px-5 pb-7 pt-5' : 'px-4 py-3'
      }`}
    >
      <img
        src={heroDish}
        alt=""
        className="chat-header-bg absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/30" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <img src={logoWordmark} alt="Edelicacies" className={fullPage ? 'h-10 w-auto' : 'h-7 w-auto'} />
          <p className={`font-display font-semibold ${fullPage ? 'mt-5 text-2xl' : 'mt-2 text-base'}`}>
            {mode === 'owner' ? 'Edelicacies team' : 'Edelicacies Assistant'}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] leading-snug text-ink-100">
            {mode === 'owner' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> You're chatting with our team
              </>
            ) : (
              'Ask me anything about our food, place an order and more.'
            )}
          </p>
        </div>
        {fullPage ? (
          <Link
            to="/"
            className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/10"
          >
            Visit site
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-white/10"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )

  const suggestions = [
    "What's on today's menu?",
    "I'd like to place an order",
    'Do you deliver to my area?',
    'What time do you open?',
  ]

  return (
    <>
      {open && (
        <div
          className={
            fullPage
              ? 'fixed inset-0 z-50 mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white sm:inset-y-4 sm:h-auto sm:rounded-2xl sm:shadow-2xl sm:shadow-black/15 sm:ring-1 sm:ring-black/10'
              : 'fixed bottom-24 right-4 z-50 flex h-[28rem] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/25 ring-1 ring-black/10'
          }
        >
          {!fullPage && header}

          <div className={`flex-1 overflow-y-auto bg-cream-50 ${fullPage ? '' : 'p-3'}`}>
            {fullPage && header}
            <div className={`space-y-2 ${fullPage ? 'p-3' : ''}`}>
              <div className="flex justify-start">
                <p className="max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm text-ink-800 ring-1 ring-ink-100">
                  {GREETING}
                </p>
              </div>

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={loading}
                      onClick={() => void sendText(q)}
                      className="rounded-full border border-brand-500/40 bg-white px-3.5 py-2 text-left text-[13px] font-medium text-brand-600 active:scale-95 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m) => {
                if (m.role === 'system') {
                  return (
                    <p key={m.id} className="px-2 py-1 text-center text-[12px] italic text-ink-400">
                      {m.content}
                    </p>
                  )
                }
                const mine = m.role === 'user'
                return (
                  <div key={m.id} className={mine ? 'flex justify-end' : 'flex flex-col items-start gap-2'}>
                    {m.role === 'owner' && (
                      <span className="-mb-1 ml-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                        Edelicacies team
                      </span>
                    )}
                    <p
                      className={
                        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ' +
                        (mine
                          ? 'bg-brand-500 text-white ' + (m.pending ? 'opacity-70' : '')
                          : m.role === 'owner'
                            ? 'bg-ink-900 text-white'
                            : 'bg-white text-ink-800 ring-1 ring-ink-100')
                      }
                    >
                      {m.content}
                    </p>
                    {m.meta?.orderNumber && (
                      <p className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
                        <span aria-hidden>✓</span> Order {m.meta.orderNumber} received, waiting for approval
                      </p>
                    )}
                    {m.meta?.enquirySaved && (
                      <p className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
                        <span aria-hidden>✓</span> Sent to the team
                      </p>
                    )}
                    {m.meta?.trackUrl && (
                      <a
                        href={m.meta.trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-white shadow-sm active:scale-95"
                      >
                        Track my order
                      </a>
                    )}
                    {m.meta?.whatsappUrl && (
                      <a
                        href={m.meta.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[13px] font-semibold text-white shadow-sm active:scale-95"
                      >
                        {m.meta.orderNumber
                          ? 'Continue on WhatsApp for payment details'
                          : 'Chat with the team on WhatsApp'}
                      </a>
                    )}
                  </div>
                )
              })}

              {loading && mode === 'ai' && (
                <div className="flex justify-start">
                  <p className="rounded-2xl bg-white px-3 py-2 text-sm text-ink-400 ring-1 ring-ink-100">
                    Typing…
                  </p>
                </div>
              )}
              {mode === 'owner' &&
                messages.length > 0 &&
                messages[messages.length - 1].role === 'user' &&
                !loading && (
                  <p className="px-2 text-center text-[12px] text-ink-400">
                    Our team has your message and will reply here shortly.
                  </p>
                )}
              {offer && (
                <div className="flex flex-col items-start gap-2">
                  <p className="max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm text-ink-800 ring-1 ring-ink-100">
                    Would you like me to remember your details ({offer.name}, {offer.phone}
                    {offer.delivery_type === 'delivery' && offer.address ? `, ${offer.address}` : ''}) on this
                    device, so you don't have to type them again next time?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        storeSavedDetails(offer)
                        setHasSaved(true)
                        setOffer(null)
                      }}
                      className="rounded-full bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white active:scale-95"
                    >
                      Yes, remember me
                    </button>
                    <button
                      type="button"
                      onClick={() => setOffer(null)}
                      className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-[13px] font-medium text-ink-600 active:scale-95"
                    >
                      No thanks
                    </button>
                  </div>
                </div>
              )}
              {hasSaved && !offer && messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    forgetSavedDetails()
                    setHasSaved(false)
                  }}
                  className="block px-2 text-[12px] text-ink-400 underline"
                >
                  Forget my saved details
                </button>
              )}
              {error && <p className="text-center text-xs text-brand-700">{error}</p>}
              <div ref={bottomRef} />
            </div>
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

      {!open && !fullPage && <CartBubble />}
      {!open && !fullPage && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          tabIndex={-1}
          aria-hidden="true"
          className="fixed bottom-[26px] right-[76px] z-40 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-800 shadow-lg shadow-black/15 ring-1 ring-black/5 active:scale-95"
        >
          Prefer to chat?
        </button>
      )}
      {!fullPage && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close chat' : 'Open chat assistant'}
          className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-black/20 active:scale-95"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H8l-4.5 4a.5.5 0 01-.83-.37V5a2 2 0 011.33-2z" />
          </svg>
          {unseen && (
            <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
          )}
        </button>
      )}
    </>
  )
}
