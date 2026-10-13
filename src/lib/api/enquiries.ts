import { supabase } from '../supabase'

export type EnquiryStatus = 'new' | 'contacted' | 'resolved'

export interface EnquiryRow {
  id: string
  created_at: string
  name: string
  contact: string
  message: string
  conversation: string | null
  status: EnquiryStatus
  note: string | null
}

export async function fetchEnquiries(): Promise<EnquiryRow[]> {
  const { data, error } = await supabase
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as EnquiryRow[]
}

export async function setEnquiryStatus(id: string, status: EnquiryStatus): Promise<void> {
  const { error } = await supabase.from('enquiries').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteEnquiry(id: string): Promise<void> {
  const { error } = await supabase.from('enquiries').delete().eq('id', id)
  if (error) throw error
}

// "0803 123 4567" -> "2348031234567" so the owner can open WhatsApp in one tap.
export function phoneToWhatsAppNumber(contact: string): string | null {
  if (contact.includes('@')) return null
  const digits = contact.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return '234' + digits.slice(1)
  return digits
}
