import { useEffect, useState } from 'react'
import { fetchEmailTemplates, updateEmailTemplate } from '../../lib/api/emailTemplates'
import { Button } from '../../components/ui/Button'
import type { EmailTemplateRow } from '../../types/db'

export function OwnerEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setTemplates(await fetchEmailTemplates())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load email templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function updateLocal(key: string, patch: Partial<EmailTemplateRow>) {
    setTemplates((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  }

  async function handleSave(t: EmailTemplateRow) {
    setSavingKey(t.key)
    setError(null)
    try {
      await updateEmailTemplate(t.key, t.subject, t.body)
      setSavedKey(t.key)
      window.setTimeout(() => setSavedKey(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this template.')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) return <p className="text-center text-[14px] text-ink-400">Loading…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-800">Email Templates</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        Edit the wording of every automated email. Order details, totals and links are always added
        automatically below your text — you're only editing the subject line and the message itself.
        Use the placeholders shown under each one exactly as written (including the double curly
        braces) and they'll be swapped for the real values when the email is sent.
      </p>

      {error && <p className="mt-4 text-[14px] font-medium text-brand-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-4">
        {templates.map((t) => (
          <section key={t.key} className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
            <h2 className="text-[15px] font-semibold text-ink-800">{t.label}</h2>

            <label className="mt-3 block text-[12px] font-semibold uppercase tracking-wide text-ink-400">
              Subject
            </label>
            <input
              value={t.subject}
              onChange={(e) => updateLocal(t.key, { subject: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <label className="mt-3 block text-[12px] font-semibold uppercase tracking-wide text-ink-400">
              Message
            </label>
            <textarea
              value={t.body}
              onChange={(e) => updateLocal(t.key, { body: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-ink-100 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <p className="mt-2 text-[12px] text-ink-400">Placeholders: {t.placeholders}</p>

            <div className="mt-3 flex items-center gap-3">
              <Button size="md" onClick={() => void handleSave(t)} disabled={savingKey === t.key}>
                {savingKey === t.key ? 'Saving…' : 'Save'}
              </Button>
              {savedKey === t.key && (
                <span className="text-[13px] font-medium text-emerald-600">Saved.</span>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
