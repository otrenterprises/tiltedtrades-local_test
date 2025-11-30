/**
 * Balance Entry Types
 */

export type BalanceEntryType = 'deposit' | 'withdrawal' | 'fee' | 'commission_adjustment'

export interface RecurringFeeConfig {
  isRecurring: true
  dayOfMonth: number // 1-31, day of month fee occurs
  endDate?: string // Optional end date (YYYY-MM-DD), if undefined continues indefinitely
}

export interface BalanceEntry {
  id: string
  date: string // YYYY-MM-DD format
  type: BalanceEntryType
  amount: number // Positive for deposits, negative for withdrawals/fees
  description: string
  balance: number // Running balance after this entry
  recurring?: RecurringFeeConfig // Only present for recurring fees
  generatedFrom?: string // ID of the recurring fee template that generated this entry
}

export interface BalanceData {
  entries: BalanceEntry[]
  recurringFees: BalanceEntry[] // Template entries for recurring fees
}
