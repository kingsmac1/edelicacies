import { supabase } from '../supabase'

export type Audience =
  | 'individual'
  | 'everyone'
  | 'subscribers'
  | 'customers'
  | 'ordered_today'
  | 'ordered_on_date'
  | 'never_ordered'
  | 'inactive_30'

export interface AudienceCounts {
  counts: Record<Exclude<Audience, 'individual'>, number>
  sentToday: number
  dailyLimit: number
  reserve: number
}

export interface SendResult {
  sent: number
  failed: string[]
  total: number
  to?: string
}

export interface CampaignRow {
  id: string
  created_at: string
  subject: string
  audience_label: string | null
  audience: string
  recipient_count: number
  sent_count: number
  failed_count: number
  failed_list: string | null
  sent_by: string | null
}

// Calls the send-broadcast Edge Function as the logged-in owner and surfaces
// its own error message (not just "non-2xx status").
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('send-broadcast', { body })
  if (error) {
    let message = error.message
    try {
      const json = await (error as { context?: Response }).context?.json()
      if (json?.error) message = json.error
    } catch {
      /* keep the generic message */
    }
    throw new Error(message)
  }
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  if (parsed?.error) throw new Error(parsed.error)
  return parsed as T
}

export function fetchAudienceCounts(date: string): Promise<AudienceCounts> {
  return call<AudienceCounts>({ action: 'counts', date })
}

export interface ComposePayload {
  audience: Audience
  audienceLabel: string
  date: string
  customEmails: string
  subject: string
  body: string
  attachments: { filename: string; content: string }[]
}

export function sendBroadcast(payload: ComposePayload): Promise<SendResult> {
  return call<SendResult>({ action: 'send', ...payload })
}

export function sendTestEmail(payload: Pick<ComposePayload, 'subject' | 'body' | 'attachments'>): Promise<SendResult> {
  return call<SendResult>({ action: 'test', ...payload })
}

export async function fetchCampaigns(): Promise<CampaignRow[]> {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('id, created_at, subject, audience_label, audience, recipient_count, sent_count, failed_count, failed_list, sent_by')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as CampaignRow[]
}

// Photos used inside emails live in the public "email-images" bucket so mail
// apps can load them.
export async function uploadEmailImage(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${crypto.randomUUID()}.${ext || 'jpg'}`
  const { error } = await supabase.storage.from('email-images').upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('email-images').getPublicUrl(path).data.publicUrl
}
