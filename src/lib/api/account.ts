import { supabase } from '../supabase'
import { loadSavedDetails } from '../savedDetails'
import type { OrderStatus } from '../../types/db'

export interface ProfileRow {
  user_id: string
  name: string | null
  phone: string | null
}

export interface AddressRow {
  id: string
  label: string
  address_text: string
  lat: number | null
  lng: number | null
  is_default: boolean
}

export interface MyOrderItem {
  id: string
  menu_item_id: string | null
  variation_id: string | null
  item_name: string
  variation_label: string
  unit_price: number
  quantity: number
}

export interface MyOrder {
  id: string
  order_number: string
  menu_date: string
  status: OrderStatus
  total: number
  delivery_type: 'dispatch' | 'pickup'
  customer_phone: string
  created_at: string
  order_items: MyOrderItem[]
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('user_id, name, phone')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as ProfileRow | null) ?? null
}

export async function saveProfile(userId: string, input: { name: string; phone: string }): Promise<void> {
  const { error } = await supabase
    .from('customer_profiles')
    .upsert({ user_id: userId, name: input.name.trim() || null, phone: input.phone.trim() || null })
  if (error) throw error
}

export async function fetchAddresses(): Promise<AddressRow[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('id, label, address_text, lat, lng, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AddressRow[]
}

// Saves a delivery address (with its map pin) unless the same text is already saved.
export async function saveAddressIfNew(
  userId: string,
  input: { addressText: string; lat: number | null; lng: number | null },
  existing: AddressRow[],
): Promise<void> {
  const text = input.addressText.trim()
  if (!text) return
  if (existing.some((a) => a.address_text.trim().toLowerCase() === text.toLowerCase())) return
  const { error } = await supabase.from('customer_addresses').insert({
    user_id: userId,
    label: existing.length === 0 ? 'Home' : `Address ${existing.length + 1}`,
    address_text: text,
    lat: input.lat,
    lng: input.lng,
    is_default: existing.length === 0,
  })
  if (error) throw error
}

export async function renameAddress(id: string, label: string): Promise<void> {
  const { error } = await supabase.from('customer_addresses').update({ label: label.trim() || 'Address' }).eq('id', id)
  if (error) throw error
}

export async function makeDefaultAddress(id: string): Promise<void> {
  const { error: clearError } = await supabase.from('customer_addresses').update({ is_default: false }).neq('id', id)
  if (clearError) throw clearError
  const { error } = await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id)
  if (error) throw error
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
  if (error) throw error
}

export async function fetchMyOrders(): Promise<MyOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, menu_date, status, total, delivery_type, customer_phone, created_at, order_items(id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity)',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as unknown as MyOrder[]
}

export async function deleteMyAccountData(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account_data')
  if (error) throw error
}

// Right after someone signs up from the "order placed" screen, turn what they
// just typed at checkout (remembered on this device) into their profile.
export async function createProfileFromSavedDetails(userId: string): Promise<void> {
  const saved = loadSavedDetails()
  if (!saved) return
  const existing = await fetchProfile(userId)
  if (!existing) await saveProfile(userId, { name: saved.name, phone: saved.phone })
  if (saved.deliveryType === 'dispatch' && saved.addressText) {
    const addresses = await fetchAddresses()
    await saveAddressIfNew(userId, { addressText: saved.addressText, lat: saved.lat, lng: saved.lng }, addresses)
  }
}

// Attach the order a guest has just placed to their new account.
export async function claimOrder(orderNumber: string, phone: string): Promise<void> {
  const { error } = await supabase.rpc('claim_order', { p_order_number: orderNumber, p_phone: phone })
  if (error) throw error
}
