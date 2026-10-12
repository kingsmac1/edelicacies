import { supabase } from './supabase'

// Failures here are logged but never thrown — a missing/misconfigured email
// function shouldn't block a customer's checkout or the owner's dashboard
// action that triggered it.

export async function sendOrderEmail(orderId: string, event: 'new_order' | 'stage_change'): Promise<void> {
  const { error } = await supabase.functions.invoke('send-order-email', { body: { orderId, event } })
  if (error) console.error('send-order-email failed', error)
}

function safeJson(text: string): { subscriberCount?: unknown; sent?: unknown } | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function notifySubscribers(
  menuDate: string,
): Promise<{ subscriberCount: number; sent: number } | null> {
  const { data, error } = await supabase.functions.invoke('notify-subscribers', { body: { menuDate } })
  if (error) {
    console.error('notify-subscribers failed', error)
    return null
  }
  // Older deployed versions reply as plain text; accept both.
  const parsed = typeof data === 'string' ? safeJson(data) : data
  const subscriberCount = Number(parsed?.subscriberCount)
  const sent = Number(parsed?.sent)
  if (!Number.isFinite(subscriberCount) || !Number.isFinite(sent)) {
    console.error('notify-subscribers returned an unexpected reply', data)
    return null
  }
  return { subscriberCount, sent }
}
