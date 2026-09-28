import { supabase } from '../supabase'
import type { OrderItemRow, OrderRow, OrderStatus } from '../../types/db'

export interface PlaceOrderInput {
  menuDate: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  deliveryType: 'dispatch' | 'pickup'
  addressText: string | null
  addressLat: number | null
  addressLng: number | null
  pickupWindowId: string | null
  dispatchFeeEstimate: number | null
  discountCode: string | null
  note: string | null
  items: { variationId: string; quantity: number }[]
}

export interface PlaceOrderResult {
  order_id: string
  order_number: string
  subtotal: number
  discount_amount: number
  total: number
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { data, error } = await supabase.rpc('place_order', {
    p_menu_date: input.menuDate,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail,
    p_delivery_type: input.deliveryType,
    p_address_text: input.addressText,
    p_address_lat: input.addressLat,
    p_address_lng: input.addressLng,
    p_pickup_window_id: input.pickupWindowId,
    p_dispatch_fee_estimate: input.dispatchFeeEstimate,
    p_discount_code: input.discountCode,
    p_note: input.note,
    p_items: input.items.map((i) => ({ variation_id: i.variationId, quantity: i.quantity })),
  })
  if (error) throw error
  return data as PlaceOrderResult
}

export interface TrackedOrder {
  order_number: string
  status: OrderStatus
  menu_date: string
  delivery_type: 'dispatch' | 'pickup'
  subtotal: number
  discount_amount: number
  dispatch_fee_estimate: number | null
  dispatch_fee_final: number | null
  total: number
  created_at: string
  items: { item_name: string; variation_label: string; unit_price: number; quantity: number }[]
}

export async function trackOrder(orderNumber: string, phone: string): Promise<TrackedOrder | null> {
  const { data, error } = await supabase.rpc('track_order', {
    p_order_number: orderNumber.trim().toUpperCase(),
    p_phone: phone.trim(),
  })
  if (error) throw error
  return data as TrackedOrder | null
}

export async function previewDiscount(
  code: string,
  subtotal: number,
): Promise<{ valid: boolean; discount_amount?: number; reason?: string }> {
  const { data, error } = await supabase.rpc('preview_discount', { p_code: code, p_subtotal: subtotal })
  if (error) throw error
  return data as { valid: boolean; discount_amount?: number; reason?: string }
}

export async function submitReview(input: {
  orderNumber: string
  phone: string
  rating: number
  comment: string
}): Promise<void> {
  const { error } = await supabase.rpc('submit_review', {
    p_order_number: input.orderNumber.trim().toUpperCase(),
    p_phone: input.phone.trim(),
    p_rating: input.rating,
    p_comment: input.comment,
  })
  if (error) throw error
}

// ---- Owner dashboard ----

export interface OrderFilters {
  status?: OrderStatus
  menuDate?: string
}

export async function fetchOrders(filters: OrderFilters = {}): Promise<OrderRow[]> {
  let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.menuDate) query = query.eq('menu_date', filters.menuDate)
  const { data, error } = await query.limit(200)
  if (error) throw error
  return (data ?? []) as OrderRow[]
}

export async function fetchOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase.from('order_items').select('*').eq('order_id', orderId)
  if (error) throw error
  return (data ?? []) as OrderItemRow[]
}

export async function setOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  finalDispatchFee?: number,
): Promise<void> {
  const { error } = await supabase.rpc('set_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_final_dispatch_fee: finalDispatchFee ?? null,
  })
  if (error) throw error
}
