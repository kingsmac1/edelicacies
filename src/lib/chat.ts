import { supabase } from './supabase'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ChatUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

// Sends the conversation so far to the "chat" Edge Function and returns the
// assistant's reply. The OpenRouter key never touches the browser — only the
// Edge Function holds it.
export interface ChatReply {
  reply: string
  usage: ChatUsage | null
  /** A wa.me link with the customer's question typed in, when the bot could not answer. */
  whatsappUrl: string | null
  /** True when the customer's details were passed to the team. */
  enquirySaved: boolean
  /** Set when the assistant placed an order for the customer (e.g. ED-0012). */
  orderNumber: string | null
  /** Link to the tracking page for the order that was just placed. */
  trackUrl: string | null
}

export async function sendChat(messages: ChatMessage[]): Promise<ChatReply> {
  const { data, error } = await supabase.functions.invoke('chat', { body: { messages } })
  if (error) throw error
  if (!data?.reply) throw new Error(data?.error ?? 'No reply')
  return {
    reply: data.reply as string,
    usage: (data.usage as ChatUsage | null) ?? null,
    whatsappUrl: typeof data.whatsappUrl === 'string' ? data.whatsappUrl : null,
    enquirySaved: Boolean(data.enquirySaved),
    orderNumber: typeof data.orderNumber === 'string' ? data.orderNumber : null,
    trackUrl: typeof data.trackUrl === 'string' ? data.trackUrl : null,
  }
}
