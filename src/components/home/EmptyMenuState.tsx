export function EmptyMenuState({ nextDate }: { nextDate?: string }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-2xl">
        🍲
      </div>
      <h2 className="mt-5 text-xl font-semibold text-ink-800">No menu today</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-400">
        {nextDate
          ? `We're not cooking today, but our next menu is scheduled for ${nextDate}. Sign up below and we'll notify you the moment it's live.`
          : "We're not cooking today. Sign up below and we'll notify you the moment the next menu is live."}
      </p>
    </div>
  )
}
