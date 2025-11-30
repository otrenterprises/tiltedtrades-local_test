/**
 * Trade API Types
 * Types matching AWS DynamoDB schema for trading data
 */

/**
 * Trading Execution - matches TradingExecutions DynamoDB table
 * Partition Key: userId, Sort Key: executionId
 */
export interface TradingExecution {
  userId: string
  executionId: string
  DBKey: string           // Original execution ID from broker
  Ticker: string          // Raw ticker symbol (e.g., "MESZ24")
  TickerConversion: string // Normalized symbol (e.g., "MES")
  Side: 'Long' | 'Short'
  Quantity: number
  ExecutionPrice: number
  Fees: number            // Negative value (cost)
  TradingDay: string      // YYYY-MM-DD
  ExecutionTime: string   // HH:MM:SS
  Status: 'Entry' | 'Exit'
  uploadTimestamp?: string
  s3Key?: string
}

/**
 * Matched Trade - matches MatchedTrades DynamoDB table
 * Partition Key: userId, Sort Key: calculationMethod_tradeId
 */
export interface MatchedTrade {
  userId: string
  calculationMethod_tradeId: string  // "fifo#entryId_exitId_index" or "perPosition#sequenceId"
  calculationMethod: 'fifo' | 'perPosition'
  tradeId: string
  symbol: string
  side: 'Long' | 'Short'
  entryDate: string       // ISO timestamp
  exitDate: string        // ISO timestamp
  tradingDay?: string     // YYYY-MM-DD - Official trading day (may differ from calendar date for futures)
  entryPrice: number
  exitPrice: number
  quantity: number
  pl: number              // Net P&L (includes commission)
  plPercent: number
  duration: number        // Minutes
  commission: number      // Negative value (cost) - may include override
  status: 'closed'
  // Optional fields for trade details
  entryExecutionId?: string
  exitExecutionId?: string
  // Commission override indicator
  hasCommissionOverride?: boolean
  // Journal existence indicator
  hasJournal?: boolean
}

/**
 * Trading Stats - matches TradingStats DynamoDB table
 * Partition Key: userId, Sort Key: statsType
 */
export interface TradingStats {
  userId: string
  statsType: 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  calculationMethod: 'fifo' | 'perPosition'
  calculatedAt: string
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number         // Percentage (0-100)
  grossPL: number
  totalPL: number         // Net P&L (gross - commission)
  totalCommission: number // Negative value (cost)
  profitFactor: number
  expectancy: number
  maxDrawdown: number
  maxDrawdownPercent: number
  averageWin?: number
  averageLoss?: number
  largestWin?: number
  largestLoss?: number
  averageHoldTime?: number
  consecutiveWins?: number
  consecutiveLosses?: number
}

/**
 * Query Parameters for Executions endpoint
 */
export interface ExecutionQueryParams {
  startDate?: string      // YYYY-MM-DD
  endDate?: string        // YYYY-MM-DD
  symbol?: string
  limit?: number
  nextToken?: string
}

/**
 * Query Parameters for Trades endpoint
 */
export interface TradeQueryParams {
  method?: 'fifo' | 'perPosition'
  calculationMethod?: 'fifo' | 'perPosition'  // Alias for method
  symbol?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
  nextToken?: string
  userId?: string         // Will be replaced by interceptor
}

/**
 * Query Parameters for Stats endpoint
 */
export interface StatsQueryParams {
  period?: 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
}

/**
 * API Response wrappers
 */
export interface ExecutionsResponse {
  executions: TradingExecution[]
  total: number
  nextToken?: string
}

export interface TradesResponse {
  trades: MatchedTrade[]
  total: number
  nextToken?: string
}

export interface StatsResponse extends TradingStats {}
