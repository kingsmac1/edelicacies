import { useEffect, useRef, useState } from 'react'
import { fetchPublicReviews } from '../../lib/api/reviews'
import type { ReviewRow } from '../../types/db'
import { Reveal } from '../ui/Reveal'

// Reviews as a 3D coverflow: the centred review is full size, its neighbours
// rotate away, shrink, blur and fade. Advances by itself every few seconds
// (paused while you hover), with arrows and a dot indicator.
export function Testimonials() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [index, setIndex] = useState(0)
  const paused = useRef(false)

  useEffect(() => {
    fetchPublicReviews()
      .then(setReviews)
      .catch(() => setReviews([]))
  }, [])

  const count = reviews.length

  useEffect(() => {
    if (count < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % count)
    }, 5200)
    return () => window.clearInterval(id)
  }, [count])

  if (count === 0) return null

  const current = index % count
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)

  return (
    <section className="overflow-hidden py-20 lg:py-28">
      <Reveal className="mx-auto max-w-6xl px-4">
        <p className="eyebrow text-ink-300">Reviews</p>
        <h2 className="display-heading mt-4 max-w-2xl text-[clamp(1.9rem,4.2vw,3.2rem)] text-white">
          What our customers are saying
        </h2>
      </Reveal>

      <div
        className="relative mx-auto mt-14 h-[340px] [perspective:1400px]"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
      >
        {reviews.map((r, i) => {
          const half = Math.floor(count / 2)
          let offset = i - current
          if (offset > half) offset -= count
          if (offset < -half) offset += count
          const abs = Math.abs(offset)

          return (
            <article
              key={r.id}
              aria-hidden={abs > 0}
              className="absolute left-1/2 top-0 flex h-[300px] w-[min(88vw,420px)] flex-col rounded-2xl bg-ink-800 p-7 ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:p-9"
              style={{
                transform: `translateX(-50%) translateX(${offset * 62}%) translateZ(${-abs * 220}px) rotateY(${offset * -34}deg) scale(${1 - abs * 0.08})`,
                opacity: abs > 2 ? 0 : 1 - abs * 0.34,
                zIndex: 10 - abs,
                pointerEvents: offset === 0 ? 'auto' : 'none',
                filter: `blur(${abs * 1.2}px)`,
              }}
            >
              <span aria-hidden className="font-display block text-5xl leading-none text-brand-500">
                &ldquo;
              </span>
              <p className="mt-4 line-clamp-6 text-[15px] leading-relaxed text-ink-100">
                {r.comment ?? 'Loved it!'}
              </p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                <p className="eyebrow truncate text-ink-300">{r.customer_name ?? 'Happy customer'}</p>
                <p className="shrink-0 text-[13px] tracking-widest text-brand-500" aria-label={`${r.rating} out of 5`}>
                  {'★'.repeat(r.rating)}
                  <span className="text-ink-600">{'★'.repeat(5 - r.rating)}</span>
                </p>
              </div>
            </article>
          )
        })}
      </div>

      {count > 1 && (
        <div className="mx-auto mt-6 flex max-w-6xl items-center justify-center gap-4 px-4">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous review"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white transition-colors hover:bg-white hover:text-ink-900"
          >
            &#8592;
          </button>
          <div className="flex items-center gap-2">
            {reviews.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show review ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === current ? 'bg-brand-500' : 'bg-white/25'
                }`}
                style={{ width: i === current ? 28 : 8 }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next review"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white transition-colors hover:bg-white hover:text-ink-900"
          >
            &#8594;
          </button>
        </div>
      )}
    </section>
  )
}
