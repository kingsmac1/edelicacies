import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { submitReview } from '../lib/api/orders'
import { Button } from '../components/ui/Button'

export function Review() {
  const [params] = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '')
  const [phone, setPhone] = useState(params.get('phone') ?? '')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!orderNumber.trim() || !phone.trim()) {
      setError('Please enter your order number and phone number.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitReview({ orderNumber, phone, rating, comment })
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('ORDER_NOT_FOUND')) setError("We couldn't find that order and phone number.")
      else if (msg.includes('ORDER_NOT_DELIVERED')) setError('This order is not marked delivered yet.')
      else if (msg.includes('ALREADY_REVIEWED')) setError("You've already reviewed this order — thank you!")
      else setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">
          🙏
        </div>
        <h1 className="mt-5 text-xl font-semibold text-ink-800">Thank you!</h1>
        <p className="mt-2 text-[15px] text-ink-400">Your review means a lot to us.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold text-ink-800">How was your order?</h1>
      <p className="mt-1 text-[14px] text-ink-400">A quick rating helps others discover us.</p>

      <div className="mt-6 flex flex-col gap-3">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order number (e.g. ED-0001)"
          className="min-h-12 rounded-xl border border-ink-100 px-4 text-[15px] uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number used at checkout"
          type="tel"
          className="min-h-12 rounded-xl border border-ink-100 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <div className="flex justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className="text-4xl leading-none"
            >
              {n <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Tell us what you thought (optional)"
          className="w-full rounded-xl border border-ink-100 px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        {error && <p className="text-[13px] font-medium text-brand-600">{error}</p>}

        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit review'}
        </Button>
      </div>
    </div>
  )
}
