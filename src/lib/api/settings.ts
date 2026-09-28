import { supabase } from '../supabase'
import type { SettingsMap } from '../../types/db'

export const DEFAULT_SETTINGS: SettingsMap = {
  announcement_banner: {
    enabled: true,
    text: 'Currently delivering in Uyo only · Fresh menu, daily',
  },
  business_hours: { text: 'Mon – Sat, 9am – 7pm' },
  shop_location: {
    lat: Number(import.meta.env.VITE_SHOP_LAT) || 5.034433,
    lng: Number(import.meta.env.VITE_SHOP_LNG) || 7.937081,
  },
  slot_hold_minutes: { minutes: 120 },
  review_delay_hours: { hours: 3 },
  max_delivery_km: { km: 20 },
  delivery_step: { step_km: 3, step_price: 500 },
  pickup_instructions: {
    text: 'Pick up your order at our shop in Uyo. We will confirm the exact address on WhatsApp.',
  },
  owner_email: { email: '' },
  expense_categories: ['Ingredients', 'Gas', 'Packaging', 'Transport', 'Staff', 'Other'],
}

export async function fetchSettings(): Promise<SettingsMap> {
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) throw error

  const result = { ...DEFAULT_SETTINGS }
  for (const row of data ?? []) {
    if (row.key in result) {
      ;(result as Record<string, unknown>)[row.key] = row.value
    }
  }
  return result
}

export async function updateSetting<K extends keyof SettingsMap>(
  key: K,
  value: SettingsMap[K],
): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ key, value })
  if (error) throw error
}
