import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { DEFAULT_SETTINGS, fetchSettings } from '../lib/api/settings'
import type { SettingsMap } from '../types/db'

export function useSettings(): SettingsMap {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    fetchSettings()
      .then((s) => {
        if (!cancelled) setSettings(s)
      })
      .catch((err) => console.error('Failed to load settings', err))
    return () => {
      cancelled = true
    }
  }, [])

  return settings
}
