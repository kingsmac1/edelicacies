import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { buildSampleDailyMenu } from '../data/sampleMenu'
import { formatDateLong, todayLagos } from '../lib/format'
import type { DailyMenu, MenuItem } from '../types/menu'
import type { MenuItemRow, MenuItemVariationRow } from '../types/db'

interface PublicDailyMenuState {
  loading: boolean
  dailyMenu: DailyMenu
  /** Tomorrow's published menu, only set when it actually has orderable items. */
  tomorrowMenu: DailyMenu | null
  isLive: boolean
  nextMenuDateLabel: string | null
}

function tomorrowLagos(): string {
  const [y, m, d] = todayLagos().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1, 12)).toISOString().slice(0, 10)
}

async function loadPublishedMenu(date: string): Promise<DailyMenu> {
  const empty: DailyMenu = { date, items: [], slots: [] }

  const { data: menu, error: menuError } = await supabase
    .from('daily_menus')
    .select('id, menu_date, published')
    .eq('menu_date', date)
    .eq('published', true)
    .maybeSingle()
  if (menuError) throw menuError
  if (!menu) return empty

  const { data: slots, error: slotsError } = await supabase
    .from('daily_menu_slots')
    .select('*')
    .eq('daily_menu_id', menu.id)
  if (slotsError) throw slotsError

  const itemIds = [...new Set((slots ?? []).map((s) => s.menu_item_id as string))]
  if (itemIds.length === 0) return empty

  const { data: items, error: itemsError } = await supabase
    .from('menu_items')
    .select('*, menu_item_variations(*)')
    .in('id', itemIds)
    .eq('active', true)
  if (itemsError) throw itemsError

  const slotVariationIds = new Set((slots ?? []).map((s) => s.variation_id as string))

  const mappedItems: MenuItem[] = (items ?? [])
    .map((row: MenuItemRow & { menu_item_variations: MenuItemVariationRow[] }) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      image: row.image_url ?? '',
      active: row.active,
      variations: row.menu_item_variations
        .filter((v) => slotVariationIds.has(v.id))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({ id: v.id, label: v.label, price: v.price })),
    }))
    .filter((item) => item.variations.length > 0)

  return {
    date,
    items: mappedItems,
    slots: (slots ?? []).map((s) => ({
      itemId: s.menu_item_id as string,
      variationId: s.variation_id as string,
      slotsTotal: s.slots_total as number,
      slotsLeft: s.slots_left as number,
      showSlots: s.show_slots as boolean,
    })),
  }
}

export function usePublicDailyMenu(): PublicDailyMenuState {
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [dailyMenu, setDailyMenu] = useState<DailyMenu>(() =>
    isSupabaseConfigured ? { date: todayLagos(), items: [], slots: [] } : buildSampleDailyMenu(),
  )
  const [tomorrowMenu, setTomorrowMenu] = useState<DailyMenu | null>(null)
  const [nextMenuDateLabel, setNextMenuDateLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false

    async function load() {
      const today = todayLagos()
      const tomorrow = tomorrowLagos()

      const [todayResult, tomorrowResult] = await Promise.all([
        loadPublishedMenu(today),
        loadPublishedMenu(tomorrow),
      ])
      if (cancelled) return

      setDailyMenu(todayResult)
      setTomorrowMenu(tomorrowResult.items.length > 0 ? tomorrowResult : null)

      if (todayResult.items.length === 0 && tomorrowResult.items.length === 0) {
        const { data: upcoming } = await supabase
          .from('daily_menus')
          .select('menu_date')
          .eq('published', true)
          .gt('menu_date', tomorrow)
          .order('menu_date', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (!cancelled) {
          setNextMenuDateLabel(upcoming ? formatDateLong(upcoming.menu_date as string) : null)
        }
      }

      if (!cancelled) setLoading(false)
    }

    load().catch((err) => {
      console.error('Failed to load daily menu', err)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { loading, dailyMenu, tomorrowMenu, isLive: isSupabaseConfigured, nextMenuDateLabel }
}
