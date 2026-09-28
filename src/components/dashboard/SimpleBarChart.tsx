interface Series {
  label: string
  color: string
  values: number[]
}

interface Props {
  categories: string[]
  series: Series[]
  height?: number
}

export function SimpleBarChart({ categories, series, height = 160 }: Props) {
  const max = Math.max(1, ...series.flatMap((s) => s.values))

  return (
    <div>
      <div className="flex items-end gap-2 overflow-x-auto" style={{ height }}>
        {categories.map((cat, i) => (
          <div key={cat} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
            <div className="flex h-full items-end gap-0.5">
              {series.map((s) => (
                <div
                  key={s.label}
                  title={`${s.label}: ${s.values[i]}`}
                  style={{
                    height: `${Math.max(2, (s.values[i] / max) * 100)}%`,
                    background: s.color,
                  }}
                  className="w-3 rounded-t-sm"
                />
              ))}
            </div>
            <span className="w-full truncate text-center text-[10px] text-ink-400">{cat.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-ink-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
