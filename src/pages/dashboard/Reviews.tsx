import { useEffect, useState, type FormEvent } from 'react'
import {
  createManualReview,
  deleteReview,
  fetchAllReviews,
  setReviewShowOnSite,
  type ReviewWithOrder,
} from '../../lib/api/reviews'
import { todayLagos } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { SuccessModal } from '../../components/ui/SuccessModal'

type Filter = 'all' | 'pending' | 'visible'

const SOURCE_LABEL: Record<string, string> = {
  order: 'From an order',
  website: 'From the website',
  admin: 'Added by you',
}

export function OwnerReviews() {
  const [reviews, setReviews] = useState<ReviewWithOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [showForm, setShowForm] = useState(false)
  const [savedPopup, setSavedPopup] = useState(false)

  // add-review form
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [date, setDate] = useState(todayLagos())
  const [showOnSite, setShowOnSite] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setReviews(await fetchAllReviews())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggle(id: string, current: boolean) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, show_on_site: !current } : r)))
    try {
      await setReviewShowOnSite(id, !current)
    } catch {
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, show_on_site: current } : r)))
      setError('Could not update that review. Please try again.')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this review for good? This cannot be undone.')) return
    try {
      await deleteReview(id)
      setReviews((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setError('Could not delete that review. Please try again.')
    }
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createManualReview({ customerName: name, rating, comment, date, showOnSite })
      setName('')
      setRating(5)
      setComment('')
      setDate(todayLagos())
      setShowOnSite(true)
      setShowForm(false)
      setSavedPopup(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review.')
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = reviews.filter((r) => !r.show_on_site).length
  const visibleCount = reviews.length - pendingCount
  const list = reviews.filter((r) =>
    filter === 'all' ? true : filter === 'pending' ? !r.show_on_site : r.show_on_site,
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-800">Reviews</h1>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'ghost' : 'primary'}>
          {showForm ? 'Cancel' : '+ Add review'}
        </Button>
      </div>

      {error && <p className="mt-3 text-[14px] font-medium text-brand-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          <p className="text-[14px] text-ink-500">
            Use this for a review someone sent you on WhatsApp, in person, or anywhere else.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink-700">Customer name</span>
              <input
                required
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink-700">Date of review</span>
              <input
                required
                type="date"
                value={date}
                max={todayLagos()}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Rating</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  onClick={() => setRating(n)}
                  className={`flex h-10 w-10 items-center justify-center text-2xl leading-none ${
                    n <= rating ? 'text-brand-500' : 'text-ink-200'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">What they said</span>
            <textarea
              rows={3}
              value={comment}
              maxLength={600}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl border border-ink-100 px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="flex items-center gap-2 text-[14px] text-ink-700">
            <input
              type="checkbox"
              checked={showOnSite}
              onChange={(e) => setShowOnSite(e.target.checked)}
              className="h-5 w-5 accent-brand-500"
            />
            Show on the website straight away
          </label>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save review'}
          </Button>
        </form>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ['all', `All (${reviews.length})`],
            ['pending', `Hidden / awaiting approval (${pendingCount})`],
            ['visible', `Showing on site (${visibleCount})`],
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
          {filter === 'pending' ? 'Nothing is waiting for approval.' : 'No reviews here yet.'}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {list.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-ink-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-brand-500">
                    {'★'.repeat(r.rating)}
                    <span className="text-ink-200">{'★'.repeat(5 - r.rating)}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-400">
                    {r.customer_name ?? 'Customer'}
                    {r.orders?.order_number ? ` · ${r.orders.order_number}` : ''} ·{' '}
                    {new Date(r.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </span>
                    {!r.show_on_site && r.source === 'website' && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Needs your approval
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-600">
                    <input
                      type="checkbox"
                      checked={r.show_on_site}
                      onChange={() => void toggle(r.id, r.show_on_site)}
                      className="h-4 w-4 accent-brand-500"
                    />
                    Show on site
                  </label>
                  <button
                    onClick={() => void handleDelete(r.id)}
                    className="text-[12px] font-medium text-ink-400 hover:text-brand-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {r.comment && <p className="mt-2 text-[14px] text-ink-600">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      <SuccessModal
        open={savedPopup}
        title="Review added!"
        message="The review has been saved."
        onClose={() => setSavedPopup(false)}
      />
    </div>
  )
}
