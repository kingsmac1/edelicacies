import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchAudienceCounts,
  fetchCampaigns,
  sendBroadcast,
  sendTestEmail,
  uploadEmailImage,
  type Audience,
  type AudienceCounts,
  type CampaignRow,
  type SendResult,
} from '../../lib/api/messaging'
import { fetchAllMenuItems } from '../../lib/api/menuItems'
import { blocksToHtml, defaultBlocks, previewShell, type EmailBlock } from '../../lib/emailBlocks'
import { todayLagos } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { SuccessModal } from '../../components/ui/SuccessModal'
import { RichTextEditor } from '../../components/dashboard/RichTextEditor'
import { EmailBuilder, type BuilderDish } from '../../components/dashboard/EmailBuilder'

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: 'individual', label: 'Specific email addresses', hint: 'Type them in yourself' },
  { value: 'everyone', label: 'Everyone', hint: 'All customers and subscribers' },
  { value: 'subscribers', label: 'Subscribers', hint: 'People who asked to be notified' },
  { value: 'customers', label: 'All customers', hint: 'Anyone who has ordered' },
  { value: 'ordered_today', label: 'Ordered today', hint: "Today's order customers" },
  { value: 'ordered_on_date', label: 'Ordered on a date', hint: 'Pick a menu date below' },
  { value: 'never_ordered', label: 'Yet to order', hint: 'Subscribers who never ordered' },
  { value: 'inactive_30', label: 'Not ordered in 30 days', hint: 'Customers to win back' },
]

type Tab = 'compose' | 'log'

const inputCls =
  'min-h-11 w-full rounded-xl border border-ink-100 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500'

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function OwnerMessaging() {
  const [tab, setTab] = useState<Tab>('compose')

  const [audience, setAudience] = useState<Audience>('subscribers')
  const [date, setDate] = useState(todayLagos())
  const [customEmails, setCustomEmails] = useState('')
  const [subject, setSubject] = useState('')
  const [mode, setMode] = useState<'simple' | 'builder'>('simple')
  const [html, setHtml] = useState('')
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks)
  const [attachments, setAttachments] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const [usage, setUsage] = useState<AudienceCounts | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [dishes, setDishes] = useState<BuilderDish[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])

  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [outcome, setOutcome] = useState<
    { kind: 'sent' | 'partial' | 'test'; result: SendResult } | null
  >(null)

  const bodyHtml = mode === 'builder' ? blocksToHtml(blocks) : html

  // Live audience sizes (they depend on the picked date for "Ordered on a date").
  useEffect(() => {
    let cancelled = false
    fetchAudienceCounts(date)
      .then((u) => {
        if (!cancelled) {
          setUsage(u)
          setUsageError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setUsageError(err instanceof Error ? err.message : 'Could not load audience sizes.')
      })
    return () => {
      cancelled = true
    }
  }, [date])

  useEffect(() => {
    fetchAllMenuItems()
      .then((items) =>
        setDishes(
          items
            .filter((i) => i.active)
            .map((i) => ({ id: i.id, name: i.name, description: i.description, image_url: i.image_url })),
        ),
      )
      .catch(() => setDishes([]))
  }, [])

  useEffect(() => {
    if (tab === 'log') fetchCampaigns().then(setCampaigns).catch(() => setCampaigns([]))
  }, [tab])

  const typedCount = customEmails.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean).length
  const count = audience === 'individual' ? typedCount : usage?.counts[audience] ?? null
  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label ?? audience
  const room = usage ? Math.max(usage.dailyLimit - usage.reserve - usage.sentToday, 0) : null
  const overLimit = count !== null && room !== null && count > room

  const previewHtml = useMemo(() => previewShell(bodyHtml), [bodyHtml])

  function validate(): string | null {
    if (audience === 'individual' && typedCount === 0) return 'Type at least one email address.'
    if (!subject.trim()) return 'Please add a subject.'
    if (!bodyHtml.trim() || bodyHtml.replace(/<[^>]*>/g, '').trim() === '') {
      return mode === 'builder' ? 'Add some content to your email.' : 'Please write your message.'
    }
    const bytes = attachments.reduce((n, f) => n + f.size, 0)
    if (bytes > 5 * 1024 * 1024) return 'Attachments are too large. Keep them under 5 MB in total.'
    return null
  }

  async function filesPayload() {
    return Promise.all(attachments.map(async (f) => ({ filename: f.name, content: await readAsBase64(f) })))
  }

  async function handleTest() {
    const problem = validate()
    if (problem && !(audience !== 'individual' && problem.includes('email address'))) {
      setError(problem)
      return
    }
    setError(null)
    setTesting(true)
    try {
      const result = await sendTestEmail({ subject: subject.trim(), body: bodyHtml, attachments: await filesPayload() })
      setOutcome({ kind: 'test', result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the test email.')
    } finally {
      setTesting(false)
    }
  }

  function askToSend() {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setConfirmOpen(true)
  }

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const result = await sendBroadcast({
        audience,
        audienceLabel,
        date,
        customEmails,
        subject: subject.trim(),
        body: bodyHtml,
        attachments: await filesPayload(),
      })
      setConfirmOpen(false)
      setOutcome({ kind: result.failed.length === 0 ? 'sent' : 'partial', result })
      if (result.failed.length === 0) {
        setSubject('')
        setHtml('')
        setBlocks(defaultBlocks())
        setCustomEmails('')
        setAttachments([])
      }
      fetchAudienceCounts(date).then(setUsage).catch(() => undefined)
    } catch (err) {
      setConfirmOpen(false)
      setError(err instanceof Error ? err.message : 'Sending failed.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold text-ink-800">Messaging</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        Send an email to customers, subscribers or specific people. Every person gets their own copy.
      </p>

      <div className="mt-4 flex gap-2">
        {(
          [
            ['compose', 'Write a message'],
            ['log', 'Sent messages'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`min-h-11 rounded-full px-5 text-[14px] font-semibold ${
              tab === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        <div className="mt-5 flex flex-col gap-2">
          {campaigns.length === 0 ? (
            <p className="mt-6 text-center text-[14px] text-ink-400">No messages sent yet.</p>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="rounded-xl bg-white p-4 ring-1 ring-ink-100">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-ink-800">{c.subject}</p>
                  <p className="text-[12px] text-ink-400">
                    {new Date(c.created_at).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className="mt-1 text-[13px] text-ink-500">
                  To: {c.audience_label ?? c.audience} · Delivered {c.sent_count} of {c.recipient_count}
                  {c.failed_count > 0 && <span className="font-semibold text-brand-600"> · {c.failed_count} failed</span>}
                </p>
                {c.failed_list && (
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-2 text-[11px] text-ink-500">
                    {c.failed_list}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex flex-col gap-5">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
              <h2 className="text-[14px] font-semibold text-ink-800">1. Who is it for?</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {AUDIENCES.map((a) => (
                  <label
                    key={a.value}
                    className={`flex cursor-pointer items-start justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                      audience === a.value ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:border-ink-200'
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="audience"
                        checked={audience === a.value}
                        onChange={() => setAudience(a.value)}
                        className="mt-1 accent-brand-500"
                      />
                      <span>
                        <span className="block text-[14px] font-medium text-ink-800">{a.label}</span>
                        <span className="block text-[12px] text-ink-400">{a.hint}</span>
                      </span>
                    </span>
                    {a.value !== 'individual' && (
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-ink-600 ring-1 ring-ink-100">
                        {usageError ? '–' : usage ? usage.counts[a.value] : '…'}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {audience === 'ordered_on_date' && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[13px] font-medium text-ink-700">Menu date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                </label>
              )}
              {audience === 'individual' && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[13px] font-medium text-ink-700">Email addresses</span>
                  <textarea
                    rows={3}
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    placeholder="One per line, or separated by commas"
                    className="w-full rounded-xl border border-ink-100 px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </label>
              )}
              {usageError && <p className="mt-2 text-[12px] text-brand-600">{usageError}</p>}

              {usage && (
                <p className={`mt-3 text-[12px] ${overLimit ? 'font-semibold text-brand-600' : 'text-ink-400'}`}>
                  Today: {usage.sentToday} sent from this page. Your plan allows {usage.dailyLimit} emails a day, and{' '}
                  {usage.reserve} are kept free for order emails, so you can send {room} more today.
                </p>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
              <h2 className="text-[14px] font-semibold text-ink-800">2. Write your message</h2>
              <label className="mt-3 block">
                <span className="mb-1 block text-[13px] font-medium text-ink-700">Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
              </label>

              <div className="mt-4 mb-2 flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-ink-700">Message</span>
                <div className="flex gap-1 rounded-full bg-ink-50 p-1">
                  {(
                    [
                      ['simple', 'Simple'],
                      ['builder', 'Email builder'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                        mode === value ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-2 text-[12px] text-ink-400">
                Tip: write <code className="rounded bg-ink-50 px-1">{'{{name}}'}</code> to greet each person by first
                name.
              </p>

              {mode === 'simple' ? (
                <RichTextEditor value={html} onChange={setHtml} />
              ) : (
                <EmailBuilder blocks={blocks} onChange={setBlocks} dishes={dishes} uploadImage={uploadEmailImage} />
              )}

              <div className="mt-4">
                <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Attachments (optional)</span>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-1.5 rounded-full bg-ink-50 py-1 pl-3 pr-1.5 text-[12px]"
                    >
                      <span className="max-w-[160px] truncate">{f.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setAttachments((p) => p.filter((_, idx) => idx !== i))}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="min-h-9 rounded-full bg-white px-4 text-[12px] font-semibold ring-1 ring-ink-100"
                  >
                    + Add file
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? [])
                      if (picked.length) setAttachments((p) => [...p, ...picked])
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
            </section>

            {error && <p className="text-[14px] font-medium text-brand-600">{error}</p>}

            <div className="flex flex-wrap gap-3">
              <Button onClick={askToSend} disabled={sending || count === 0 || overLimit}>
                {count ? `Send to ${count}` : 'Send'}
              </Button>
              <Button variant="secondary" onClick={() => void handleTest()} disabled={testing}>
                {testing ? 'Sending test…' : 'Send a test to me'}
              </Button>
            </div>
            {overLimit && (
              <p className="text-[13px] font-medium text-brand-600">
                This audience is bigger than what you can send today. Pick a smaller group, or send it tomorrow.
              </p>
            )}
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Preview</p>
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              className="h-[34rem] w-full rounded-2xl border border-ink-100 bg-white"
            />
          </aside>
        </div>
      )}

      {/* Confirm before sending */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button aria-label="Close" onClick={() => !sending && setConfirmOpen(false)} className="absolute inset-0 bg-ink-900/50" />
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-ink-800">Send this email?</h3>
            <p className="mt-2 text-[14px] text-ink-500">
              <span className="font-semibold text-ink-800">{subject.trim()}</span>
            </p>
            <p className="mt-1 text-[14px] text-ink-500">
              Going to <span className="font-semibold text-ink-800">{count ?? '?'}</span> {count === 1 ? 'person' : 'people'}
              {': '}
              {audienceLabel}
              {audience === 'ordered_on_date' ? ` (${date})` : ''}.
            </p>
            <p className="mt-2 text-[12px] text-ink-400">Once sent, it can't be taken back.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button fullWidth onClick={() => void handleSend()} disabled={sending}>
                {sending ? 'Sending… please keep this page open' : 'Yes, send it'}
              </Button>
              <Button fullWidth variant="ghost" onClick={() => setConfirmOpen(false)} disabled={sending}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        open={outcome !== null}
        tone={outcome?.kind === 'partial' ? 'warning' : 'success'}
        title={
          outcome?.kind === 'test'
            ? 'Test email sent'
            : outcome?.kind === 'partial'
              ? 'Some emails did not go out'
              : 'Message sent!'
        }
        message={
          outcome
            ? outcome.kind === 'test'
              ? `A test copy was sent to ${outcome.result.to ?? 'your email'}. Check your inbox.`
              : outcome.kind === 'partial'
                ? `Delivered to ${outcome.result.sent} of ${outcome.result.total}. ${outcome.result.failed.length} failed. See "Sent messages" for details.`
                : `Your email went to ${outcome.result.sent} ${outcome.result.sent === 1 ? 'person' : 'people'}.`
            : undefined
        }
        onClose={() => setOutcome(null)}
      />
    </div>
  )
}
