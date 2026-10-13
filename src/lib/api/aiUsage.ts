import { supabase } from '../supabase'

export interface UsageRow {
  id: number
  created_at: string
  conversation_id: string | null
  kind: 'chat' | 'budget_stop'
  model: string | null
  total_tokens: number
  cost: number
  latency_ms: number | null
  ok: boolean
  error: string | null
}

export interface ChatStartRow {
  id: string
  created_at: string
  ever_handed_off: boolean
}

export interface GapMessage {
  id: number
  conversation_id: string
  role: 'user' | 'assistant' | 'owner' | 'system'
  content: string
  created_at: string
}

export interface AiBudget {
  usd: number
  max_calls: number
}

export async function fetchUsageSince(sinceIso: string): Promise<UsageRow[]> {
  const { data, error } = await supabase
    .from('ai_usage')
    .select('id, created_at, conversation_id, kind, model, total_tokens, cost, latency_ms, ok, error')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data ?? []) as UsageRow[]
}

export async function fetchChatsSince(sinceIso: string): Promise<ChatStartRow[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, created_at, ever_handed_off')
    .gte('created_at', sinceIso)
    .limit(5000)
  if (error) throw error
  return (data ?? []) as ChatStartRow[]
}

export async function fetchRecentMessages(sinceIso: string): Promise<GapMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, role, content, created_at')
    .gte('created_at', sinceIso)
    .in('role', ['user', 'assistant'])
    .order('id', { ascending: true })
    .limit(1500)
  if (error) throw error
  return (data ?? []) as GapMessage[]
}

export async function countSince(table: 'orders' | 'enquiries', sinceIso: string, onlyChat = false): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true }).gte('created_at', sinceIso)
  if (onlyChat) q = q.eq('source', 'chat')
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

export async function fetchBudget(): Promise<AiBudget> {
  const { data } = await supabase.from('settings').select('value').eq('key', 'ai_daily_budget').maybeSingle()
  const v = (data?.value ?? {}) as Partial<AiBudget>
  return { usd: Number(v.usd) || 1, max_calls: Number(v.max_calls) || 400 }
}

export interface GapRow {
  id: number
  created_at: string
  expires_at: string
  conversation_id: string | null
  question: string
  bot_reply: string | null
  status: 'open' | 'done'
}

// Gaps that have not expired yet (they stay for 14 days on their own).
export async function fetchGaps(): Promise<GapRow[]> {
  const { data, error } = await supabase
    .from('knowledge_gaps')
    .select('id, created_at, expires_at, conversation_id, question, bot_reply, status')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data ?? []) as GapRow[]
}

export async function markGapsDone(ids: number[]): Promise<void> {
  const { error } = await supabase.from('knowledge_gaps').update({ status: 'done' }).in('id', ids)
  if (error) throw error
}

export async function deleteGaps(ids: number[]): Promise<void> {
  const { error } = await supabase.from('knowledge_gaps').delete().in('id', ids)
  if (error) throw error
}
