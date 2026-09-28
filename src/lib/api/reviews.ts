import { supabase } from '../supabase'
import type { ReviewRow } from '../../types/db'

export interface ReviewWithOrder extends ReviewRow {
  orders: { order_number: string } | null
}

export async function fetchAllReviews(): Promise<ReviewWithOrder[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, orders(order_number)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ReviewWithOrder[]
}

export async function setReviewShowOnSite(id: string, showOnSite: boolean): Promise<void> {
  const { error } = await supabase.from('reviews').update({ show_on_site: showOnSite }).eq('id', id)
  if (error) throw error
}

export async function fetchPublicReviews(): Promise<ReviewRow[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('show_on_site', true)
    .order('created_at', { ascending: false })
    .limit(12)
  if (error) throw error
  return (data ?? []) as ReviewRow[]
}
