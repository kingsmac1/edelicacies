import { supabase } from './supabase'

// Failures here are logged but never thrown — a missing/misconfigured email
// function shouldn't block a customer's checkout or the owner's dashboard
// action that triggered it.

export async function sendOrderEmail(orderId: string, event: 'new_order' | 'stage_change'): Promise<void> {
  const { error } = await supabase.functions.invoke('send-order-email', { body: { orderId, event } })
  if (error) console.error('send-order-email failed', error)
}

export async function notifySubscribers(
  menuDate: string,
): Promise<{ subscriberCount: number; sent: number } | null> {
  const { data, error } = await supabase.functions.invoke('notify-subscribers', { body: { menuDate } })
  if (error) {
    console.error('notify-subscribers failed', error)
    return null
  }
  return data as { subscriberCount: number; sent: number }
}
