import { supabase } from '../supabase'
import type { DailyMenuRow, DailyMenuSlotRow } from '../../types/db'

export async function getDailyMenuByDate(
  date: string,
): Promise<{ menu: DailyMenuRow | null; slots: DailyMenuSlotRow[] }> {
  const { data: menu, error } = await supabase
    .from('daily_menus')
    .select('*')
    .eq('menu_date', date)
    .maybeSingle()
  if (error) throw error
  if (!menu) return { menu: null, slots: [] }

  const { data: slots, error: slotsError } = await supabase
    .from('daily_menu_slots')
    .select('*')
    .eq('daily_menu_id', menu.id)
  if (slotsError) throw slotsError

  return { menu: menu as DailyMenuRow, slots: (slots ?? []) as DailyMenuSlotRow[] }
}

export async function ensureDailyMenu(date: string): Promise<DailyMenuRow> {
  const { data: existing, error: fetchError } = await supabase
    .from('daily_menus')
    .select('*')
    .eq('menu_date', date)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (existing) return existing as DailyMenuRow

  const { data: created, error: insertError } = await supabase
    .from('daily_menus')
    .insert({ menu_date: date, published: true })
    .select('*')
    .single()
  if (insertError) throw insertError
  return created as DailyMenuRow
}

export async function setDailyMenuPublished(dailyMenuId: string, published: boolean): Promise<void> {
  const { error } = await supabase.from('daily_menus').update({ published }).eq('id', dailyMenuId)
  if (error) throw error
}

/**
 * Creates or updates the slot for one variation on one day. If the slot
 * already exists, slots_left is shifted by the same delta as slots_total so
 * portions already sold (once orders exist, from Phase 4) are preserved
 * rather than reset.
 */
export async function upsertSlot(input: {
  dailyMenuId: string
  menuItemId: string
  variationId: string
  slotsTotal: number
  showSlots: boolean
}): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('daily_menu_slots')
    .select('id, slots_total, slots_left')
    .eq('daily_menu_id', input.dailyMenuId)
    .eq('variation_id', input.variationId)
    .maybeSingle()
  if (fetchError) throw fetchError

  if (existing) {
    const delta = input.slotsTotal - existing.slots_total
    const nextLeft = Math.max(0, Math.min(input.slotsTotal, existing.slots_left + delta))
    const { error } = await supabase
      .from('daily_menu_slots')
      .update({ slots_total: input.slotsTotal, slots_left: nextLeft, show_slots: input.showSlots })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('daily_menu_slots').insert({
    daily_menu_id: input.dailyMenuId,
    menu_item_id: input.menuItemId,
    variation_id: input.variationId,
    slots_total: input.slotsTotal,
    slots_left: input.slotsTotal,
    show_slots: input.showSlots,
  })
  if (error) throw error
}

export async function removeSlot(slotId: string): Promise<void> {
  const { error } = await supabase.from('daily_menu_slots').delete().eq('id', slotId)
  if (error) throw error
}

export async function listMenuDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('daily_menus')
    .select('menu_date')
    .order('menu_date', { ascending: false })
    .limit(60)
  if (error) throw error
  return (data ?? []).map((d) => d.menu_date as string)
}

export async function copyDayToDate(sourceDate: string, targetDate: string): Promise<number> {
  const source = await getDailyMenuByDate(sourceDate)
  if (!source.menu || source.slots.length === 0) return 0

  const target = await ensureDailyMenu(targetDate)

  const { error } = await supabase.from('daily_menu_slots').upsert(
    source.slots.map((s) => ({
      daily_menu_id: target.id,
      menu_item_id: s.menu_item_id,
      variation_id: s.variation_id,
      slots_total: s.slots_total,
      slots_left: s.slots_total,
      show_slots: s.show_slots,
    })),
    { onConflict: 'daily_menu_id,variation_id' },
  )
  if (error) throw error
  return source.slots.length
}
