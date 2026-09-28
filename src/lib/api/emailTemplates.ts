import { supabase } from '../supabase'
import type { EmailTemplateRow } from '../../types/db'

export async function fetchEmailTemplates(): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabase.from('email_templates').select('*').order('key')
  if (error) throw error
  return (data ?? []) as EmailTemplateRow[]
}

export async function updateEmailTemplate(key: string, subject: string, body: string): Promise<void> {
  const { error } = await supabase.from('email_templates').update({ subject, body }).eq('key', key)
  if (error) throw error
}
