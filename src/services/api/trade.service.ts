/**
 * Trade Service - AWS API Gateway Implementation
 *
 * Fetches executions, matched trades, and stats from AWS API Gateway.
 * Server handles all trade matching (FIFO and Per Position) and statistics calculation.
 */

import { apiClient } from './client'
import {
  TradingExecution,
  MatchedTrade,
  TradingStats,
  TradeQueryParams,
  ExecutionQueryParams,
  StatsQueryParams,
  ExecutionsResponse,
  TradesResponse,
} from '@/types/api/trade.types'

// API Endpoints - :userId is replaced by the API client interceptor
const ENDPOINTS = {
  executions: '/api/users/:userId/executions',
  trades: '/api/users/:userId/trades',
  stats: '/api/users/:userId/stats',
}

export const tradeService = {
  /**
   * Fetch trading executions from API
   */
  async getExecutions(params?: ExecutionQueryParams): Promise<TradingExecution[]> {
    console.log('📡 API: getExecutions called', params)

    const queryParams: Record<string, string> = {}
    if (params?.startDate) queryParams.startDate = params.startDate
    if (params?.endDate) queryParams.endDate = params.endDate
    if (params?.symbol) queryParams.symbol = params.symbol
    if (params?.limit) queryParams.limit = String(params.limit)
    if (params?.nextToken) queryParams.nextToken = params.nextToken

    const response = await apiClient.get<ExecutionsResponse | TradingExecution[]>(
      ENDPOINTS.executions,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    )

    // Handle both array response and wrapped response
    if (Array.isArray(response)) {
      return response
    }
    return response.executions || []
  },

  /**
   * Fetch matched trades from API
   * Server returns pre-calculated trades (FIFO or Per Position)
   */
  async getTrades(params?: TradeQueryParams): Promise<{ trades: MatchedTrade[]; total: number }> {
    // Normalize calculation method parameter
    const method = params?.method || params?.calculationMethod || 'fifo'
    console.log('📡 API: getTrades called', { method, ...params })

    const queryParams: Record<string, string> = {
      method: method,
    }
    if (params?.symbol) queryParams.symbol = params.symbol
    if (params?.startDate) queryParams.startDate = params.startDate
    if (params?.endDate) queryParams.endDate = params.endDate
    if (params?.limit) queryParams.limit = String(params.limit)
    if (params?.nextToken) queryParams.nextToken = params.nextToken

    const response = await apiClient.get<TradesResponse | MatchedTrade[]>(
      ENDPOINTS.trades,
      queryParams
    )

    // Handle both array response and wrapped response
    if (Array.isArray(response)) {
      // Apply client-side offset/limit if needed (API may not support these)
      let trades = response
      if (params?.offset) {
        trades = trades.slice(params.offset)
      }
      if (params?.limit) {
        trades = trades.slice(0, params.limit)
      }
      return { trades, total: response.length }
    }

    return {
      trades: response.trades || [],
      total: response.total || response.trades?.length || 0,
    }
  },

  /**
   * Fetch trading statistics from API
   * Server returns pre-calculated stats
   */
  async getStats(params?: StatsQueryParams): Promise<TradingStats | null> {
    const period = params?.period || 'ALL'
    console.log('📡 API: getStats called', { period })

    try {
      const response = await apiClient.get<TradingStats>(ENDPOINTS.stats, { period })
      return response
    } catch (error) {
      console.error('❌ Error fetching stats:', error)
      return null
    }
  },

  /**
   * Get the last calculated timestamp for stats
   * Used to detect when processing has completed after an upload
   */
  async getStatsTimestamp(): Promise<string | null> {
    try {
      const stats = await this.getStats({ period: 'ALL' })
      return stats?.calculatedAt || null
    } catch (error) {
      console.error('❌ Error fetching stats timestamp:', error)
      return null
    }
  },

  /**
   * Poll for processing completion after upload
   * Resolves when stats.calculatedAt changes from the baseline
   * @param baselineTimestamp - The calculatedAt value before upload started
   * @param options - Polling configuration
   */
  async pollForProcessingComplete(
    baselineTimestamp: string | null,
    options: {
      maxAttempts?: number
      initialDelayMs?: number
      maxDelayMs?: number
      onProgress?: (attempt: number, maxAttempts: number) => void
    } = {}
  ): Promise<{ success: boolean; newTimestamp?: string; timedOut?: boolean }> {
    const {
      maxAttempts = 60,      // 5 minutes with exponential backoff
      initialDelayMs = 2000, // Start polling every 2 seconds
      maxDelayMs = 10000,    // Max 10 seconds between polls
      onProgress
    } = options

    let attempt = 0
    let delay = initialDelayMs

    while (attempt < maxAttempts) {
      attempt++
      onProgress?.(attempt, maxAttempts)

      try {
        const currentTimestamp = await this.getStatsTimestamp()

        // If we have a new timestamp that's different from baseline, processing is complete
        if (currentTimestamp && currentTimestamp !== baselineTimestamp) {
          console.log('✅ Processing complete - stats updated:', currentTimestamp)
          return { success: true, newTimestamp: currentTimestamp }
        }

        // If baseline was null and we now have a timestamp, that's also completion
        if (!baselineTimestamp && currentTimestamp) {
          console.log('✅ Processing complete - first stats available:', currentTimestamp)
          return { success: true, newTimestamp: currentTimestamp }
        }
      } catch (error) {
        console.warn(`⚠️ Poll attempt ${attempt} failed:`, error)
        // Continue polling on error
      }

      // Wait before next poll with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * 1.5, maxDelayMs) // Exponential backoff capped at maxDelay
    }

    console.warn('⏱️ Processing poll timed out after', maxAttempts, 'attempts')
    return { success: false, timedOut: true }
  },

  /**
   * Fetch a single trade by ID
   */
  async getTradeById(
    tradeId: string,
    calculationMethod: 'fifo' | 'perPosition' = 'fifo'
  ): Promise<MatchedTrade | null> {
    console.log('📡 API: getTradeById called', { tradeId, calculationMethod })

    try {
      // Fetch all trades and find by ID (API may not have single trade endpoint)
      const result = await this.getTrades({ method: calculationMethod })
      const trade = result.trades.find(
        (t) => t.tradeId === tradeId || t.calculationMethod_tradeId.includes(tradeId)
      )
      return trade || null
    } catch (error) {
      console.error('❌ Error finding trade:', error)
      return null
    }
  },

  /**
   * Fetch all trades (handles pagination if needed)
   */
  async getAllTrades(
    params?: Omit<TradeQueryParams, 'nextToken'>
  ): Promise<{ trades: MatchedTrade[]; total: number }> {
    // For now, just call getTrades without pagination limits
    return await this.getTrades({ ...params, limit: undefined, offset: undefined })
  },

  /**
   * Fetch trades by date range
   */
  async getTradesByDateRange(
    startDate: string | Date,
    endDate: string | Date,
    params?: Omit<TradeQueryParams, 'startDate' | 'endDate'>
  ): Promise<{ trades: MatchedTrade[]; total: number }> {
    const start = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0]
    const end = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0]

    return await this.getTrades({
      ...params,
      startDate: start,
      endDate: end,
    })
  },

  /**
   * Fetch trades by symbol
   */
  async getTradesBySymbol(
    symbol: string,
    params?: Omit<TradeQueryParams, 'symbol'>
  ): Promise<{ trades: MatchedTrade[]; total: number }> {
    return await this.getTrades({
      ...params,
      symbol,
    })
  },

  /**
   * Upload executions - redirects to upload service
   * Note: Actual upload uses presigned S3 URLs, not direct API upload
   */
  async uploadExecutions(_userId: string, _file: File): Promise<void> {
    throw new Error(
      'Use uploadService.uploadFile() for file uploads. This method is deprecated.'
    )
  },
}
