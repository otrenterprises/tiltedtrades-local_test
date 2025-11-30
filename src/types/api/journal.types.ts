/**
 * Journal API Types
 * Types for trade journal operations
 */

export interface TradeJournal {
  userId: string
  tradeId: string
  rawTradeId?: string // Original tradeId without method prefix (e.g., "123_456_0" vs "fifo#123_456_0")
  calculationMethod: 'fifo' | 'perPosition'
  symbol: string
  exitDate: string
  journalText: string
  tags: string[]
  chartReferences?: ChartReference[]
  emotionalState?: EmotionalState
  tradingPlan?: TradingPlan
  commissionOverride?: CommissionOverride
  createdAt: string
  updatedAt: string
  version?: number
}

export interface ChartReference {
  chartId: string
  chartType: 'uploaded' | 'tradingview' | 'internal'
  s3Key?: string
  url?: string
  caption?: string
  description?: string
  uploadedAt: string
}

export interface EmotionalState {
  preTradeEmotion?: 'confident' | 'anxious' | 'calm' | 'rushed' | 'fearful' | 'greedy'
  postTradeEmotion?: 'satisfied' | 'frustrated' | 'relieved' | 'regret' | 'euphoric' | 'disappointed'
  stressLevel?: number // 1-10
}

export interface TradingPlan {
  entryPlan?: string
  stopLoss?: number
  targetProfit?: number
  positionSize?: number
  adheredToPlan?: boolean
}

/**
 * Commission override stored with journal entry
 */
export interface CommissionOverride {
  originalCommission: number
  overrideCommission: number
  reason?: string
}

export interface CreateJournalRequest {
  journalText: string
  tags?: string[]
  symbol?: string
  exitDate?: string
  calculationMethod?: 'fifo' | 'perPosition'
  emotionalState?: EmotionalState
  tradingPlan?: TradingPlan
  commissionOverride?: {
    overrideCommission: number
    reason?: string
  }
}

export interface UpdateJournalRequest extends CreateJournalRequest {
  version?: number // For optimistic concurrency control
}

export interface JournalQueryParams {
  tags?: string[] // Filter by tags
  symbol?: string
  calculationMethod?: 'fifo' | 'perPosition'
  startDate?: string
  endDate?: string
  limit?: number
  nextToken?: string
}

export interface ChartUploadRequest {
  chartType: 'uploaded' | 'tradingview'
  fileExtension?: string
  caption?: string
  url?: string // For TradingView charts
}