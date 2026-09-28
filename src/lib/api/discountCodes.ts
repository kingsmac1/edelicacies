import { supabase } from '../supabase'
import type { DiscountCodeRow } from '../../types/db'

export async function fetchDiscountCodes(): Promise<DiscountCodeRow[]> {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DiscountCodeRow[]
}

export interface DiscountCodeInput {
  code: string
  percentOff: number | null
  fixedOff: number | null
  startDate: string | null
  endDate: string | null
  maxUses: number | null
  minOrderAmount: number | null
  active: boolean
}

export async function createDiscountCode(input: DiscountCodeInput): Promise<void> {
  const { error } = await supabase.from('discount_codes').insert({
    code: input.code.toUpperCase(),
    percent_off: input.percentOff,
    fixed_off: input.fixedOff,
    start_date: input.startDate,
    end_date: input.endDate,
    max_uses: input.maxUses,
    min_order_amount: input.minOrderAmount,
    active: input.active,
  })
  if (error) throw error
}

export async function updateDiscountCode(id: string, input: DiscountCodeInput): Promise<void> {
  const { error } = await supabase
    .from('discount_codes')
    .update({
      code: input.code.toUpperCase(),
      percent_off: input.percentOff,
      fixed_off: input.fixedOff,
      start_date: input.startDate,
      end_date: input.endDate,
      max_uses: input.maxUses,
      min_order_amount: input.minOrderAmount,
      active: input.active,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id)
  if (error) throw error
}
