import { supabase } from '../supabase'

export interface ConversationRow {
  id: string
  created_at: string
  last_message_at: string
  mode: 'ai' | 'owner'
  handoff_reason: string | null
  handoff_at: string | null
  owner_unread: boolean
  last_preview: string | null
  last_role: string | null
  customer_name: string | null
  customer_contact: string | null
  channel: 'web' | 'whatsapp'
}

export interface ThreadMessage {
  id: number
  role: 'user' | 'assistant' | 'owner' | 'system'
  content: string
  meta: Record<string, unknown> | null
  created_at: string
}

export async function fetchConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, created_at, last_message_at, mode, handoff_reason, handoff_at, owner_unread, last_preview, last_role, customer_name, customer_contact, channel',
    )
    .order('last_message_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as ConversationRow[]
}

export async function fetchThread(conversationId: string): Promise<ThreadMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, meta, created_at')
    .eq('conversation_id', conversationId)
    .order('id', { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []) as ThreadMessage[]
}

// A reply to a website visitor is saved in the database and they see it on
// their next check. A reply to a WhatsApp customer must also be delivered
// through WhatsApp, which only the "whatsapp" function can do.
export async function sendOwnerReply(
  conversationId: string,
  content: string,
  channel: 'web' | 'whatsapp' = 'web',
): Promise<void> {
  if (channel === 'whatsapp') {
    const { error } = await supabase.functions.invoke('whatsapp', {
      body: { action: 'owner_reply', conversationId, content },
    })
    if (error) {
      let message = 'Could not send the WhatsApp reply.'
      try {
        const res = (error as { context?: Response }).context
        const json = await res?.json()
        if (json?.message) message = json.message
        else if (json?.error) message = String(json.error)
      } catch {
        /* keep the generic message */
      }
      throw new Error(message)
    }
    return
  }
  const { error } = await supabase.rpc('owner_send_message', {
    p_conversation_id: conversationId,
    p_content: content,
  })
  if (error) throw error
}

export async function setConversationMode(conversationId: string, mode: 'ai' | 'owner'): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_mode', {
    p_conversation_id: conversationId,
    p_mode: mode,
  })
  if (error) throw error
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.from('conversations').update({ owner_unread: false }).eq('id', conversationId)
  if (error) throw error
}

export async function countUnreadConversations(): Promise<number> {
  const { count, error } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('owner_unread', true)
  if (error) throw error
  return count ?? 0
}

// Permanently removes a chat and all its messages.
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
  if (error) throw error
}

// Removes every chat that has had no activity for `days` days.
export async function deleteConversationsOlderThan(days: number): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const { error } = await supabase.from('conversations').delete().lt('last_message_at', cutoff)
  if (error) throw error
}
