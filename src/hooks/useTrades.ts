/**
 * useTrades Hook
 * React Query hooks for trade data fetching from AWS API
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tradeService } from '@/services/api/trade.service'
import { TradeQueryParams, MatchedTrade, TradingStats, StatsQueryParams } from '@/types/api/trade.types'
import { Trade } from '@/types/execution.types'

/**
 * Transform API MatchedTrade to component Trade format
 */
function transformToTrade(apiTrade: MatchedTrade): Trade {
  return {
    id: apiTrade.tradeId || apiTrade.calculationMethod_tradeId,
    symbol: apiTrade.symbol,
    side: apiTrade.side,
    entryDate: new Date(apiTrade.entryDate),
    exitDate: apiTrade.exitDate ? new Date(apiTrade.exitDate) : null,
    tradingDay: apiTrade.tradingDay, // Official trading day (may differ from calendar date for futures)
    entryPrice: apiTrade.entryPrice,
    exitPrice: apiTrade.exitPrice,
    quantity: apiTrade.quantity,
    pl: apiTrade.pl,
    plPercent: apiTrade.plPercent,
    duration: apiTrade.duration,
    executions: [], // API doesn't return executions with trades
    commission: apiTrade.commission,
    status: apiTrade.status === 'closed' ? 'closed' : 'open',
    hasCommissionOverride: apiTrade.hasCommissionOverride,
    hasJournal: apiTrade.hasJournal,
  }
}

/**
 * Hook to fetch matched trades
 */
export const useTrades = (params?: TradeQueryParams) => {
  return useQuery({
    queryKey: ['trades', params],
    queryFn: async () => {
      const result = await tradeService.getTrades(params)
      return {
        trades: result.trades.map(transformToTrade),
        total: result.total,
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to fetch trading stats from API
 */
export const useStats = (params?: StatsQueryParams) => {
  return useQuery({
    queryKey: ['stats', params],
    queryFn: () => tradeService.getStats(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Hook to fetch executions from API
 */
export const useExecutions = (params?: { startDate?: string; endDate?: string; symbol?: string }) => {
  return useQuery({
    queryKey: ['executions', params],
    queryFn: () => tradeService.getExecutions(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Circuit breaker to prevent infinite loops
const queryExecutionTracker = new Map<string, { count: number; lastReset: number }>()
const MAX_EXECUTIONS_PER_MINUTE = 5
const RESET_INTERVAL = 60000 // 1 minute

function checkCircuitBreaker(queryKey: string): boolean {
  const now = Date.now()
  const tracker = queryExecutionTracker.get(queryKey)

  if (!tracker || now - tracker.lastReset > RESET_INTERVAL) {
    queryExecutionTracker.set(queryKey, { count: 1, lastReset: now })
    return true
  }

  if (tracker.count >= MAX_EXECUTIONS_PER_MINUTE) {
    console.error(
      `🚨 CIRCUIT BREAKER: Query "${queryKey}" exceeded ${MAX_EXECUTIONS_PER_MINUTE} executions per minute. Blocking further executions.`
    )
    return false
  }

  tracker.count++
  return true
}

/**
 * Hook to fetch a single trade
 */
export const useTrade = (
  userId: string,
  tradeId: string,
  calculationMethod: 'fifo' | 'perPosition' = 'fifo'
) => {
  return useQuery({
    queryKey: ['trade', userId, tradeId, calculationMethod],
    queryFn: async () => {
      const queryKey = `trade-${userId}-${tradeId}-${calculationMethod}`

      if (!checkCircuitBreaker(queryKey)) {
        throw new Error('Circuit breaker activated - too many query executions')
      }

      console.log('🔍 useTrade queryFn executing:', { userId, tradeId, calculationMethod })

      const apiTrade = await tradeService.getTradeById(tradeId, calculationMethod)

      if (!apiTrade) {
        console.log('❌ Trade not found')
        return null
      }

      console.log('✅ Trade found:', apiTrade.symbol)
      return transformToTrade(apiTrade)
    },
    enabled: !!userId && !!tradeId,
    // Don't cache forever - allow refetch on mount to handle navigation changes
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
    refetchOnMount: true, // Re-fetch when component mounts (navigation)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/**
 * Hook to fetch all trades (handles pagination)
 */
export const useAllTrades = (params?: Omit<TradeQueryParams, 'nextToken'>) => {
  return useQuery({
    queryKey: ['allTrades', params],
    queryFn: async () => {
      const result = await tradeService.getAllTrades(params)
      return {
        trades: result.trades.map(transformToTrade),
        total: result.total,
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Hook to fetch trades by date range
 */
export const useTradesByDateRange = (
  startDate: string | Date,
  endDate: string | Date,
  params?: Omit<TradeQueryParams, 'startDate' | 'endDate'>
) => {
  return useQuery({
    queryKey: ['trades', 'dateRange', startDate, endDate, params],
    queryFn: async () => {
      const result = await tradeService.getTradesByDateRange(startDate, endDate, params)
      return {
        trades: result.trades.map(transformToTrade),
        total: result.total,
      }
    },
    enabled: !!startDate && !!endDate,
  })
}

/**
 * Hook to fetch trades by symbol
 */
export const useTradesBySymbol = (symbol: string, params?: Omit<TradeQueryParams, 'symbol'>) => {
  return useQuery({
    queryKey: ['trades', 'symbol', symbol, params],
    queryFn: async () => {
      const result = await tradeService.getTradesBySymbol(symbol, params)
      return {
        trades: result.trades.map(transformToTrade),
        total: result.total,
      }
    },
    enabled: !!symbol,
  })
}

/**
 * Hook to invalidate trade queries
 */
export const useInvalidateTrades = () => {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['allTrades'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    invalidateBySymbol: (symbol: string) => {
      queryClient.invalidateQueries({ queryKey: ['trades', 'symbol', symbol] })
    },
    invalidateSingle: (tradeId: string) => {
      queryClient.invalidateQueries({ queryKey: ['trade', tradeId] })
    },
  }
}
