import { supabase } from '../supabase'
import type { DeliveryBandRow, PickupWindowRow } from '../../types/db'

export async function fetchDeliveryBands(): Promise<DeliveryBandRow[]> {
  const { data, error } = await supabase.from('delivery_bands').select('*').order('sort_order')
  if (error) throw error
  return (data ?? []) as DeliveryBandRow[]
}

export async function createDeliveryBand(input: {
  min_km: number
  max_km: number
  price: number
  sort_order: number
}): Promise<void> {
  const { error } = await supabase.from('delivery_bands').insert(input)
  if (error) throw error
}

export async function updateDeliveryBand(
  id: string,
  input: { min_km: number; max_km: number; price: number },
): Promise<void> {
  const { error } = await supabase.from('delivery_bands').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteDeliveryBand(id: string): Promise<void> {
  const { error } = await supabase.from('delivery_bands').delete().eq('id', id)
  if (error) throw error
}

export async function fetchPickupWindows(activeOnly = false): Promise<PickupWindowRow[]> {
  let query = supabase.from('pickup_windows').select('*').order('sort_order')
  if (activeOnly) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PickupWindowRow[]
}

export async function createPickupWindow(label: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('pickup_windows').insert({ label, sort_order: sortOrder })
  if (error) throw error
}

export async function updatePickupWindow(
  id: string,
  input: { label: string; active: boolean },
): Promise<void> {
  const { error } = await supabase.from('pickup_windows').update(input).eq('id', id)
  if (error) throw error
}

export async function deletePickupWindow(id: string): Promise<void> {
  const { error } = await supabase.from('pickup_windows').delete().eq('id', id)
  if (error) throw error
}
