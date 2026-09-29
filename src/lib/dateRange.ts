import { todayLagos } from './format'

export type RangePreset = 'today' | 'week' | 'month' | 'all'

export interface DateRange {
  start: string
  end: string
}

export interface RangeValue {
  preset: RangePreset
  custom: DateRange | null
}

export const defaultRangeValue: RangeValue = { preset: 'month', custom: null }

export function presetRange(preset: RangePreset): DateRange {
  const today = todayLagos()
  if (preset === 'today') return { start: today, end: today }
  const d = new Date(today)
  if (preset === 'week') {
    const start = new Date(d)
    start.setDate(d.getDate() - 6)
    return { start: start.toISOString().slice(0, 10), end: today }
  }
  if (preset === 'month') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    return { start: start.toISOString().slice(0, 10), end: today }
  }
  return { start: '2020-01-01', end: today }
}

export function resolveRange(value: RangeValue): DateRange {
  return value.custom ?? presetRange(value.preset)
}
