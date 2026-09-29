import type { RangePreset, RangeValue } from '../../lib/dateRange'
import { todayLagos } from '../../lib/format'

const PRESETS: RangePreset[] = ['today', 'week', 'month', 'all']

export function RangeFilter({ value, onChange }: { value: RangeValue; onChange: (next: RangeValue) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => onChange({ preset: p, custom: null })}
          className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold capitalize ${
            !value.custom && value.preset === p ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'
          }`}
        >
          {p === 'all' ? 'All time' : p}
        </button>
      ))}
      <input
        type="date"
        value={value.custom?.start ?? ''}
        onChange={(e) => onChange({ preset: value.preset, custom: { start: e.target.value, end: value.custom?.end ?? todayLagos() } })}
        className="min-h-9 min-w-0 rounded-lg border border-ink-100 px-2 text-[13px]"
      />
      <input
        type="date"
        value={value.custom?.end ?? ''}
        onChange={(e) => onChange({ preset: value.preset, custom: { start: value.custom?.start ?? '2020-01-01', end: e.target.value } })}
        className="min-h-9 min-w-0 rounded-lg border border-ink-100 px-2 text-[13px]"
      />
    </div>
  )
}
