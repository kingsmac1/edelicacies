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
export async function sendChat(
  messages: ChatMessage[],
): Promise<{ reply: string; usage: ChatUsage | null }> {
  const { data, error } = await supabase.functions.invoke('chat', { body: { messages } })
  if (error) throw error
  if (!data?.reply) throw new Error(data?.error ?? 'No reply')
  return { reply: data.reply as string, usage: (data.usage as ChatUsage | null) ?? null }
}
