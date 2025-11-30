/**
 * Balance API Types
 *
 * Types for the Balance API endpoints (entries and recurring fee templates)
 */

export type BalanceEntryType = 'deposit' | 'withdrawal' | 'fee' | 'commission_adjustment'

/**
 * Metadata for commission adjustment entries
 */
export interface CommissionAdjustmentMeta {
  tradeCount?: number
  contractCount?: number
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  symbol?: string // Trading symbol (e.g., "MES", "ES")
}

/**
 * Balance entry from the API
 */
export interface ApiBalanceEntry {
  userId: string
  entryId: string
  type: BalanceEntryType
  amount: number // Always positive for deposit/withdrawal/fee, signed for commission_adjustment
  date: string // YYYY-MM-DD format
  description: string
  balance?: number // Running balance (calculated on read)
  generatedFromTemplate?: string // Template ID if auto-generated
  commissionMeta?: CommissionAdjustmentMeta // Only for commission_adjustment type
  createdAt: string
  updatedAt: string
}

/**
 * Recurring fee template from the API
 */
export interface ApiRecurringTemplate {
  userId: string
  entryId: string
  type: BalanceEntryType
  amount: number // Always positive
  date: string // Start date for generating entries
  description: string
  dayOfMonth: number // 1-28, day of month fee occurs
  endDate?: string | null // Optional end date (YYYY-MM-DD)
  createdAt: string
  updatedAt: string
}

/**
 * Response from GET /balance
 */
export interface BalanceResponse {
  entries: ApiBalanceEntry[]
  templates: ApiRecurringTemplate[]
  runningBalance: number
}

/**
 * Response from GET /balance/templates
 */
export interface TemplatesResponse {
  templates: ApiRecurringTemplate[]
}

/**
 * Request body for POST /balance
 */
export interface CreateBalanceEntryRequest {
  type: BalanceEntryType
  amount: number
  date: string
  description?: string
  // Commission adjustment metadata (only for commission_adjustment type)
  tradeCount?: number
  contractCount?: number
  startDate?: string
  endDate?: string
  symbol?: string
}

/**
 * Request body for PUT /balance/:entryId
 */
export interface UpdateBalanceEntryRequest {
  type?: BalanceEntryType
  amount?: number
  date?: string
  description?: string
  // Commission adjustment metadata (only for commission_adjustment type)
  tradeCount?: number
  contractCount?: number
  startDate?: string
  endDate?: string
  symbol?: string
}

/**
 * Request body for POST /balance/templates
 */
export interface CreateTemplateRequest {
  type: BalanceEntryType
  amount: number
  date: string // Start date
  description?: string
  dayOfMonth: number // 1-28
  endDate?: string // Optional end date
}

/**
 * Request body for PUT /balance/templates/:templateId
 */
export interface UpdateTemplateRequest {
  type?: BalanceEntryType
  amount?: number
  date?: string
  description?: string
  dayOfMonth?: number
  endDate?: string | null
}
