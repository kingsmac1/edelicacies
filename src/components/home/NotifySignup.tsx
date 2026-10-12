import { useState, type FormEvent } from 'react'
import { subscribe } from '../../lib/api/subscribers'
import { Button } from '../ui/Button'

export function NotifySignup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await subscribe({ name, email, whatsapp })
      setSubmitted(true)
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bg-brand-500">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
        <h2 className="text-2xl font-medium text-white">Notify me when the menu is live</h2>
        <p className="mt-2 max-w-md text-[15px] text-white/90">
          On days without a menu, we'll ping you the moment it's ready — straight to your email and WhatsApp.
        </p>

        {submitted ? (
          <p className="mt-6 rounded-xl bg-white/20 px-4 py-3 text-[15px] font-medium text-white">
            Thanks! We'll let you know as soon as the next menu is live.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 grid gap-3 sm:grid-cols-3">
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="min-h-12 rounded-xl border-0 bg-white px-4 text-[15px] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-900"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="min-h-12 rounded-xl border-0 bg-white px-4 text-[15px] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-900"
            />
            <input
              required
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="WhatsApp number"
              className="min-h-12 rounded-xl border-0 bg-white px-4 text-[15px] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-900"
            />
            {error && <p className="rounded-lg bg-white/20 px-3 py-2 text-[13px] font-semibold text-white sm:col-span-3">{error}</p>}
            <Button type="submit" variant="dark" className="sm:col-span-3" disabled={submitting}>
              {submitting ? 'Signing up…' : 'Notify me'}
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}
