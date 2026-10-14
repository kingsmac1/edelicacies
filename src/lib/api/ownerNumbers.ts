import { supabase } from '../supabase'

export interface OwnerNumber {
  id: string
  name: string
  phone: string
  status: 'pending' | 'active'
  verified_at: string | null
  created_at: string
}

export interface AdminLogRow {
  id: number
  created_at: string
  actor: string
  action: string
  summary: string
  before_value?: Record<string, unknown> | null
  after_value?: Record<string, unknown> | null
}

export async function fetchOwnerNumbers(): Promise<OwnerNumber[]> {
  const { data, error } = await supabase
    .from('owner_numbers')
    .select('id, name, phone, status, verified_at, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as OwnerNumber[]
}

// Every change goes through a database function, which also writes the log.
export async function addOwnerNumber(name: string, phone: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_owner_number', { p_name: name, p_phone: phone })
  if (error) throw error
  return data as string
}

export async function renameOwnerNumber(id: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_owner_number', { p_id: id, p_name: name })
  if (error) throw error
}

export async function removeOwnerNumber(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_owner_number', { p_id: id })
  if (error) throw error
}

export async function confirmOwnerNumber(id: string, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('confirm_owner_number', { p_id: id, p_code: code })
  if (error) throw error
  return data === true
}

// Asks the whatsapp function to text a verification code to that number.
export async function sendOwnerNumberCode(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('whatsapp', {
    body: { action: 'send_owner_code', ownerNumberId: id },
  })
  if (error) {
    // No response at all (browser could not reach it) usually means the
    // function has not been deployed yet.
    let message =
      'The WhatsApp function is not reachable yet. In Supabase, deploy the "whatsapp" Edge Function (Verify JWT off), then try again.'
    try {
      const res = (error as { context?: Response }).context
      if (res) {
        const json = await res.json()
        message = json?.message ?? json?.error ?? 'Could not send the code.'
      }
    } catch {
      message = 'Could not send the code.'
    }
    throw new Error(message)
  }
}

export async function fetchAdminLog(limit = 30, beforeId?: number): Promise<AdminLogRow[]> {
  let q = supabase
    .from('admin_log')
    .select('id, created_at, actor, action, summary, before_value, after_value')
    .order('id', { ascending: false })
    .limit(limit)
  if (beforeId) q = q.lt('id', beforeId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AdminLogRow[]
}

export function friendlyOwnerNumberError(err: unknown): string {
  const msg = err instanceof Error ? err.message : JSON.stringify(err)
  if (msg.includes('ALREADY_EXISTS')) return 'That number is already on the list.'
  if (msg.includes('INVALID_PHONE')) return 'That does not look like a phone number. Use the format 0801 234 5678 or +234 801 234 5678.'
  if (msg.includes('INVALID_NAME')) return 'Please enter a name (up to 60 letters).'
  if (msg.includes('TOO_MANY_ATTEMPTS')) return 'Too many wrong codes. Remove the number and add it again.'
  if (msg.includes('CODE_EXPIRED')) return 'That code has expired. Send a new one.'
  if (msg.includes('NO_CODE')) return 'No code has been sent yet. Press Send code first.'
  if (msg.includes('TOO_MANY')) return 'You can register up to 5 owner numbers.'
  if (msg.includes('NOT_ALLOWED')) return 'Only the logged-in owner can change this list.'
  return msg || 'Something went wrong. Please try again.'
}
