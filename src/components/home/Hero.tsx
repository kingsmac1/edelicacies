import { formatDateLong } from '../../lib/format'
import heroDish from '../../assets/menu/native-rice-turkey-snails.jpg'

export function Hero({ date, mode = 'today' }: { date: string; mode?: 'today' | 'tomorrow' }) {
  const isTomorrow = mode === 'tomorrow'

  return (
    <section className="relative overflow-hidden bg-ink-900">
      <img
        src={heroDish}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/20" />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pb-16 sm:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white ring-1 ring-white/20">
          Delivering in Uyo · {formatDateLong(date)}
        </span>
        <h1 className="mt-4 max-w-md text-4xl font-medium leading-[1.08] text-white sm:text-5xl">
          Good food, made fresh for your taste buds.
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-100">
          {isTomorrow
            ? "Tomorrow's menu is up for pre-order — order now and it'll be ready for that day."
            : "Today's menu — order for delivery or pickup. Slots are limited, so grab yours before it's gone."}
        </p>
        <a
          href="#menu"
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-brand-500 px-7 text-[15px] font-semibold text-white shadow-lg shadow-brand-900/30 active:scale-[0.97]"
        >
          {isTomorrow ? "See tomorrow's menu" : 'See today\'s menu'}
        </a>
      </div>
    </section>
  )
}
