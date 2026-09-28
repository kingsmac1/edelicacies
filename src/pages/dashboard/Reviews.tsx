import { useEffect, useState } from 'react'
import { fetchAllReviews, setReviewShowOnSite, type ReviewWithOrder } from '../../lib/api/reviews'

export function OwnerReviews() {
  const [reviews, setReviews] = useState<ReviewWithOrder[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      setReviews(await fetchAllReviews())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggle(id: string, current: boolean) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, show_on_site: !current } : r)))
    await setReviewShowOnSite(id, !current)
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Reviews</h1>

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">No reviews yet.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-ink-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-ink-800">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </p>
                  <p className="text-[12px] text-ink-400">
                    {r.customer_name ?? 'Customer'} · {r.orders?.order_number}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink-600">
                  <input
                    type="checkbox"
                    checked={r.show_on_site}
                    onChange={() => void toggle(r.id, r.show_on_site)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  Show on site
                </label>
              </div>
              {r.comment && <p className="mt-2 text-[14px] text-ink-600">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
