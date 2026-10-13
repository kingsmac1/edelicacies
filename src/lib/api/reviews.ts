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

// Website visitors: adds a review that stays hidden until the owner approves it.
export async function submitPublicReview(input: {
  name: string
  rating: number
  comment: string
  website: string
}): Promise<void> {
  const { error } = await supabase.rpc('submit_public_review', {
    p_name: input.name,
    p_rating: input.rating,
    p_comment: input.comment,
    p_website: input.website,
  })
  if (error) throw error
}

// Owner: type in a review received some other way (WhatsApp, in person...).
export async function createManualReview(input: {
  customerName: string
  rating: number
  comment: string
  date: string
  showOnSite: boolean
}): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    order_id: null,
    source: 'admin',
    customer_name: input.customerName.trim() || null,
    rating: input.rating,
    comment: input.comment.trim() || null,
    show_on_site: input.showOnSite,
    created_at: new Date(`${input.date}T12:00:00`).toISOString(),
  })
  if (error) throw error
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) throw error
}

// Owner: fix a typo, soften wording, change the date or rating of any review.
export async function updateReview(
  id: string,
  input: { customerName: string; rating: number; comment: string; date: string; keepTimeOf: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    customer_name: input.customerName.trim() || null,
    rating: input.rating,
    comment: input.comment.trim() || null,
  }
  // Only touch the timestamp if the day was actually changed.
  if (input.keepTimeOf.slice(0, 10) !== input.date) {
    patch.created_at = new Date(`${input.date}T12:00:00`).toISOString()
  }
  const { error } = await supabase.from('reviews').update(patch).eq('id', id)
  if (error) throw error
}
