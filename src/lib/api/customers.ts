import { supabase } from '../supabase'
import type { CustomerRow, OrderRow } from '../../types/db'

export async function fetchCustomers(): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('total_spent', { ascending: false })
  if (error) throw error
  return (data ?? []) as CustomerRow[]
}

export async function fetchCustomerOrders(phone: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as OrderRow[]
}
