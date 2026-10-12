import { useEffect, useState, type FormEvent } from 'react'
import { submitPublicReview } from '../../lib/api/reviews'
import { Button } from '../ui/Button'
import { Reveal } from '../ui/Reveal'

// An "Add your review" button that opens the review form in a popup. Open to
// everyone. New reviews are saved hidden; the owner switches them on from
// Dashboard → Reviews.
export function ReviewForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [website, setWebsite] = useState('') // hidden field: only bots fill it in
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape closes the popup, and the page behind it stops scrolling.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  function openForm() {
    // A fresh form each time, unless they only just finished one.
    if (done) {
      setName('')
      setRating(5)
      setComment('')
      setDone(false)
    }
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await submitPublicReview({ name, rating, comment, website })
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      if (msg.includes('TOO_MANY')) setError('We are getting a lot of reviews right now. Please try again a bit later.')
      else if (msg.includes('MISSING_NAME')) setError('Please enter your name.')
      else setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const shown = hover || rating

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-6 lg:pb-28">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <p className="eyebrow text-ink-300">Share your experience</p>
          <p className="text-[17px] font-medium text-white">Enjoyed Edelicacies?</p>
          <p className="max-w-sm text-[14px] text-ink-200">Tell us how we did. It takes less than a minute.</p>
          <Button onClick={openForm} className="mt-2">
            Add your review
          </Button>
        </Reveal>
      </section>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            aria-label="Close review form"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            className="animate-pop-in relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-ink-400 hover:bg-ink-50"
            >
              ×
            </button>

            {done ? (
              <div className="py-4 text-center">
                <svg className="mx-auto h-16 w-16 text-emerald-500" viewBox="0 0 52 52" fill="none" aria-hidden="true">
                  <circle className="animate-check-circle" cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2.5" />
                  <path
                    className="animate-check-mark"
                    d="M14.1 27.2l7.1 7.2 16.7-16.8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 id="review-title" className="mt-4 text-lg font-semibold text-ink-800">
                  Thank you!
                </h3>
                <p className="mt-1.5 text-[14px] text-ink-500">
                  Your review has been received and will appear on the site once we approve it.
                </p>
                <Button fullWidth className="mt-5" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <h3 id="review-title" className="pr-10 text-xl font-medium text-ink-800">
                  Add your review
                </h3>
                <p className="mt-1 text-[14px] text-ink-400">Tell us how we did.</p>

                <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                  <div>
                    <p className="mb-1.5 text-[14px] font-medium text-ink-700">Your rating</p>
                    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-label={`${n} star${n === 1 ? '' : 's'}`}
                          aria-pressed={rating === n}
                          onClick={() => setRating(n)}
                          onMouseEnter={() => setHover(n)}
                          className={`flex h-11 w-11 items-center justify-center text-3xl leading-none ${
                            n <= shown ? 'text-brand-500' : 'text-ink-200'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-[14px] font-medium text-ink-700">Your name</span>
                    <input
                      required
                      maxLength={80}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ekaette"
                      className="min-h-12 w-full rounded-xl border border-ink-100 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[14px] font-medium text-ink-700">Your review</span>
                    <textarea
                      rows={4}
                      maxLength={600}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="What did you order? How was it?"
                      className="w-full rounded-xl border border-ink-100 px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </label>

                  {/* Honeypot: invisible to people, tempting to bots. */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  />

                  {error && <p className="text-[14px] font-medium text-brand-600">{error}</p>}
                  <Button type="submit" size="lg" fullWidth disabled={submitting}>
                    {submitting ? 'Sending…' : 'Submit review'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
