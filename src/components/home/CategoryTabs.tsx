import clsx from 'clsx'
import type { MenuCategory } from '../../types/menu'

interface Props {
  active: MenuCategory | 'all'
  onChange: (value: MenuCategory | 'all') => void
}

const TABS: { id: MenuCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'food', label: 'Food' },
  { id: 'drink', label: 'Drinks' },
]

export function CategoryTabs({ active, onChange }: Props) {
  return (
    <div className="no-scrollbar sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto border-b border-ink-100 bg-cream-50/95 px-4 py-3 backdrop-blur">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'min-h-11 shrink-0 rounded-full px-5 text-[14px] font-semibold transition-colors',
            active === tab.id ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
