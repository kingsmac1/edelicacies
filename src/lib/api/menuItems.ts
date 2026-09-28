import { supabase } from '../supabase'
import type { MenuItemRow, MenuItemVariationRow } from '../../types/db'

export interface VariationInput {
  id?: string
  label: string
  price: number
}

export interface MenuItemWithVariations extends MenuItemRow {
  menu_item_variations: MenuItemVariationRow[]
}

export async function fetchAllMenuItems(): Promise<MenuItemWithVariations[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_item_variations(*)')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((item) => ({
    ...item,
    menu_item_variations: [...item.menu_item_variations].sort(
      (a: MenuItemVariationRow, b: MenuItemVariationRow) => a.sort_order - b.sort_order,
    ),
  })) as MenuItemWithVariations[]
}

export async function uploadMenuItemImage(itemId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${itemId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('menu-images').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
  })
  if (error) throw error
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
  return data.publicUrl
}

export async function createMenuItem(input: {
  name: string
  category: 'food' | 'drink'
  description: string
  imageUrl: string | null
  active: boolean
  variations: VariationInput[]
}): Promise<string> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      name: input.name,
      category: input.category,
      description: input.description,
      image_url: input.imageUrl,
      active: input.active,
    })
    .select('id')
    .single()
  if (error) throw error
  const itemId = data.id as string

  if (input.variations.length > 0) {
    const { error: varError } = await supabase.from('menu_item_variations').insert(
      input.variations.map((v, idx) => ({
        menu_item_id: itemId,
        label: v.label,
        price: v.price,
        sort_order: idx,
      })),
    )
    if (varError) throw varError
  }

  return itemId
}

export async function updateMenuItem(
  itemId: string,
  input: {
    name: string
    category: 'food' | 'drink'
    description: string
    imageUrl: string | null
    active: boolean
    variations: VariationInput[]
  },
): Promise<void> {
  const { error } = await supabase
    .from('menu_items')
    .update({
      name: input.name,
      category: input.category,
      description: input.description,
      image_url: input.imageUrl,
      active: input.active,
    })
    .eq('id', itemId)
  if (error) throw error

  await replaceVariations(itemId, input.variations)
}

async function replaceVariations(itemId: string, submitted: VariationInput[]): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('menu_item_variations')
    .select('id')
    .eq('menu_item_id', itemId)
  if (fetchError) throw fetchError

  const existingIds = new Set((existing ?? []).map((v) => v.id as string))
  const submittedIds = new Set(submitted.filter((v) => v.id).map((v) => v.id as string))

  const toDelete = [...existingIds].filter((id) => !submittedIds.has(id))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('menu_item_variations').delete().in('id', toDelete)
    if (error) throw error
  }

  for (const [idx, v] of submitted.entries()) {
    if (v.id && existingIds.has(v.id)) {
      const { error } = await supabase
        .from('menu_item_variations')
        .update({ label: v.label, price: v.price, sort_order: idx })
        .eq('id', v.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('menu_item_variations')
        .insert({ menu_item_id: itemId, label: v.label, price: v.price, sort_order: idx })
      if (error) throw error
    }
  }
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().eq('id', itemId)
  if (error) throw error
}

export async function setMenuItemActive(itemId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('menu_items').update({ active }).eq('id', itemId)
  if (error) throw error
}
