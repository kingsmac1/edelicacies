import { supabase } from '../supabase'
import type { ManualSaleRow, OrderRow } from '../../types/db'

export interface ManualSaleInput {
  saleDate: string
  customerName: string
  customerPhone: string
  itemsText: string
  amount: number
  deliveryFee: number
  paymentMethod: string
  note: string
  paid: boolean
}

export async function fetchManualSales(): Promise<ManualSaleRow[]> {
  const { data, error } = await supabase
    .from('manual_sales')
    .select('*')
    .order('sale_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as ManualSaleRow[]
}

export async function createManualSale(input: ManualSaleInput): Promise<void> {
  const { error } = await supabase.from('manual_sales').insert({
    sale_date: input.saleDate,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    items_text: input.itemsText,
    amount: input.amount,
    delivery_fee: input.deliveryFee,
    payment_method: input.paymentMethod,
    note: input.note,
    paid: input.paid,
  })
  if (error) throw error
}

export async function updateManualSale(id: string, input: ManualSaleInput): Promise<void> {
  const { error } = await supabase
    .from('manual_sales')
    .update({
      sale_date: input.saleDate,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      items_text: input.itemsText,
      amount: input.amount,
      delivery_fee: input.deliveryFee,
      payment_method: input.paymentMethod,
      note: input.note,
      paid: input.paid,
    })
    .eq('id', id)
  if (error) throw error
}

export async function setManualSalePaid(id: string, paid: boolean): Promise<void> {
  const { error } = await supabase.from('manual_sales').update({ paid }).eq('id', id)
  if (error) throw error
}

export async function deleteManualSale(id: string): Promise<void> {
  const { error } = await supabase.from('manual_sales').delete().eq('id', id)
  if (error) throw error
}

export async function fetchOnlinePaidOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .neq('status', 'awaiting_payment')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as OrderRow[]
}
