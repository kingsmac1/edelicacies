import { supabase } from '../supabase'
import type { ExpenseRow } from '../../types/db'

export interface ExpenseInput {
  expenseDate: string
  category: string
  amount: number
  note: string
}

export async function fetchExpenses(): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as ExpenseRow[]
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const { error } = await supabase.from('expenses').insert({
    expense_date: input.expenseDate,
    category: input.category,
    amount: input.amount,
    note: input.note,
  })
  if (error) throw error
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      expense_date: input.expenseDate,
      category: input.category,
      amount: input.amount,
      note: input.note,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}
