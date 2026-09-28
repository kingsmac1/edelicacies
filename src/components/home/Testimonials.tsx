import { useEffect, useState } from 'react'
import { fetchPublicReviews } from '../../lib/api/reviews'
import type { ReviewRow } from '../../types/db'

export function Testimonials() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])

  useEffect(() => {
    fetchPublicReviews()
      .then(setReviews)
      .catch(() => setReviews([]))
  }, [])

  if (reviews.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="text-2xl font-medium text-ink-800">What customers say</h2>
      <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="w-72 shrink-0 rounded-2xl bg-white p-5 ring-1 ring-ink-100"
          >
            <p className="text-brand-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
            {r.comment && <p className="mt-2 text-[14px] leading-relaxed text-ink-600">"{r.comment}"</p>}
            <p className="mt-3 text-[13px] font-medium text-ink-400">{r.customer_name ?? 'Happy customer'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
