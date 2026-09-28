import { supabase } from '../supabase'
import type { SubscriberRow } from '../../types/db'

export async function subscribe(input: { name: string; email: string; whatsapp: string }): Promise<void> {
  const { error } = await supabase.from('subscribers').insert({
    name: input.name,
    email: input.email,
    whatsapp: input.whatsapp,
  })
  if (error) throw error
}

export async function fetchSubscribers(): Promise<SubscriberRow[]> {
  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .eq('unsubscribed', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SubscriberRow[]
}

export async function deleteSubscriber(id: string): Promise<void> {
  const { error } = await supabase.from('subscribers').delete().eq('id', id)
  if (error) throw error
}

export async function unsubscribeById(id: string): Promise<void> {
  const { error } = await supabase.from('subscribers').update({ unsubscribed: true }).eq('id', id)
  if (error) throw error
}
