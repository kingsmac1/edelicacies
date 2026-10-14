import { supabase } from '../supabase'

export interface OwnerChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StoredOwnerMessage extends OwnerChatMessage {
  at: string
}

// The conversation is kept in the database, so a refresh (or another device)
// finds it exactly as you left it.
export async function loadOwnerChat(limit = 200): Promise<StoredOwnerMessage[]> {
  const { data, error } = await supabase
    .from('owner_chat_messages')
    .select('role, content, created_at')
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as string, at: r.created_at as string }))
}

export async function saveOwnerChatMessage(role: 'user' | 'assistant', content: string): Promise<void> {
  const { error } = await supabase.from('owner_chat_messages').insert({ role, content: content.slice(0, 4000) })
  if (error) console.error('could not save chat message', error)
}

export async function clearOwnerChat(): Promise<void> {
  const { error } = await supabase.from('owner_chat_messages').delete().gte('id', 0)
  if (error) throw error
}

export interface OwnerAssistantReply {
  reply: string
  needsPin: boolean
}

// `pin` travels in its own field, never inside a chat message, and is never
// saved in the conversation history.
export async function askOwnerAssistant(messages: OwnerChatMessage[], pin?: string): Promise<OwnerAssistantReply> {
  const { data, error } = await supabase.functions.invoke('owner-assistant', {
    body: { messages, ...(pin ? { pin } : {}) },
  })
  if (error) {
    let message = 'The owner assistant is not reachable yet. Deploy the "owner-assistant" Edge Function in Supabase, then try again.'
    try {
      const res = (error as { context?: Response }).context
      if (res) {
        const json = await res.json()
        message = json?.error ?? 'Something went wrong. Please try again.'
      }
    } catch {
      message = 'Something went wrong. Please try again.'
    }
    throw new Error(message)
  }
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  if (parsed?.error) throw new Error(parsed.error)
  return { reply: String(parsed?.reply ?? ''), needsPin: parsed?.needsPin === true }
}

export async function ownerHasPin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('owner_has_pin')
  if (error) return false
  return data === true
}

export async function saveOwnerPin(newPin: string, currentPin?: string): Promise<'ok' | 'wrong' | 'locked'> {
  const { data, error } = await supabase.rpc('set_owner_pin', { p_new: newPin, p_current: currentPin ?? null })
  if (error) {
    if (String(error.message).includes('INVALID_PIN')) throw new Error('The PIN must be 4 to 6 digits.')
    throw error
  }
  const status = (data as { status?: string } | null)?.status
  if (status === 'ok') return 'ok'
  if (status === 'locked') return 'locked'
  return 'wrong'
}
