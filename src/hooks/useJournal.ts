/**
 * useJournal Hook
 * Provides data fetching and mutations for trade journals
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { journalService } from '../services/api/journal.service'
import { TradeJournal, JournalQueryParams } from '@/types/api/journal.types'
import { toast } from 'react-hot-toast'

// Query keys - include calculationMethod to differentiate FIFO vs perPosition journals
const QUERY_KEYS = {
  journal: (userId: string, tradeId: string, calculationMethod?: 'fifo' | 'perPosition') =>
    ['journal', userId, tradeId, calculationMethod || 'fifo'],
  journals: (userId: string) => ['journals', userId],
  journalsByTag: (userId: string, tag: string) => ['journals', userId, 'tag', tag],
  journalsByDateRange: (userId: string, startDate: string, endDate: string) =>
    ['journals', userId, 'range', startDate, endDate]
}

/**
 * Hook to fetch a single trade journal
 * @param calculationMethod - 'fifo' or 'perPosition' to fetch the correct journal
 */
export function useJournal(userId: string, tradeId: string, calculationMethod?: 'fifo' | 'perPosition') {
  return useQuery({
    queryKey: QUERY_KEYS.journal(userId, tradeId, calculationMethod),
    queryFn: () => journalService.getJournal(userId, tradeId, calculationMethod),
    enabled: !!userId && !!tradeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  })
}

/**
 * Hook to fetch all journals for a user
 */
export function useJournals(userId: string, params?: JournalQueryParams) {
  return useQuery({
    queryKey: ['journals', userId, params],
    queryFn: () => journalService.getJournals(userId, params),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1
  })
}

/**
 * Hook to search journals by tag
 */
export function useJournalsByTag(userId: string, tag: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.journalsByTag(userId, tag),
    queryFn: () => journalService.searchByTag(userId, tag),
    enabled: !!userId && !!tag && enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1
  })
}

/**
 * Hook to fetch journals within a date range
 */
export function useJournalsByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.journalsByDateRange(userId, startDate, endDate),
    queryFn: () => journalService.getJournalsByDateRange(userId, startDate, endDate),
    enabled: !!userId && !!startDate && !!endDate && enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1
  })
}

/**
 * Hook to save/update a journal
 */
export function useSaveJournal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      tradeId,
      journalText,
      tags,
      symbol,
      exitDate,
      calculationMethod
    }: {
      userId: string
      tradeId: string
      journalText: string
      tags?: string[]
      symbol?: string
      exitDate?: string
      calculationMethod?: 'fifo' | 'perPosition'
    }) =>
      journalService.saveJournal(userId, tradeId, { journalText, tags, symbol, exitDate, calculationMethod }),
    onSuccess: (data, variables) => {
      // Invalidate and refetch relevant queries with calculationMethod
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journal(variables.userId, variables.tradeId, variables.calculationMethod)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journals(variables.userId)
      })
      // Also invalidate any journals list queries with different params
      queryClient.invalidateQueries({
        queryKey: ['journals']
      })
    },
    onError: (error: any) => {
      console.error('Failed to save journal:', error)
      toast.error(error.message || 'Failed to save journal')
    }
  })
}

/**
 * Hook to delete a journal
 */
export function useDeleteJournal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, tradeId, calculationMethod }: { userId: string; tradeId: string; calculationMethod?: 'fifo' | 'perPosition' }) =>
      journalService.deleteJournal(userId, tradeId, calculationMethod),
    onSuccess: (_, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journal(variables.userId, variables.tradeId, variables.calculationMethod)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journals(variables.userId)
      })

      toast.success('Journal deleted successfully')
    },
    onError: (error: any) => {
      console.error('Failed to delete journal:', error)
      toast.error(error.response?.data?.error || 'Failed to delete journal')
    }
  })
}

/**
 * Hook to upload a chart image
 */
export function useUploadChart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      tradeId,
      file,
      description
    }: { userId: string; tradeId: string; file: File; description?: string }) => {
      // Use direct upload for local storage
      return await journalService.uploadChartDirect(userId, tradeId, file, description)
    },
    onSuccess: (data, variables) => {
      // Invalidate journal query to refresh chart list
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journal(variables.userId, variables.tradeId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journals(variables.userId)
      })

      toast.success('Chart uploaded successfully')
    },
    onError: (error: any) => {
      console.error('Failed to upload chart:', error)
      toast.error(error.message || 'Failed to upload chart')
    }
  })
}

/**
 * Hook to delete a chart
 */
export function useDeleteChart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      tradeId,
      chartId,
      calculationMethod
    }: { userId: string; tradeId: string; chartId: string; calculationMethod?: 'fifo' | 'perPosition' }) =>
      journalService.deleteChart(userId, tradeId, chartId, calculationMethod),
    onSuccess: (_, variables) => {
      // Invalidate journal query to refresh chart list
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journal(variables.userId, variables.tradeId, variables.calculationMethod)
      })

      toast.success('Chart deleted successfully')
    },
    onError: (error: any) => {
      console.error('Failed to delete chart:', error)
      toast.error(error.response?.data?.error || 'Failed to delete chart')
    }
  })
}

/**
 * Hook to get all unique tags used in journals
 */
export function useJournalTags(userId: string) {
  return useQuery({
    queryKey: ['journalTags', userId],
    queryFn: () => journalService.getAllTags(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1
  })
}

/**
 * Hook to save a commission override for a trade
 * This invalidates trades and stats queries since the backend recalculates stats
 */
export function useSaveCommissionOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      tradeId,
      overrideCommission,
      reason,
      existingJournalText,
      calculationMethod
    }: {
      userId: string
      tradeId: string
      overrideCommission: number
      reason?: string
      existingJournalText?: string
      calculationMethod?: 'fifo' | 'perPosition'
    }) =>
      journalService.saveCommissionOverride(userId, tradeId, overrideCommission, reason, existingJournalText, calculationMethod),
    onSuccess: (data, variables) => {
      // Invalidate journal queries with calculationMethod
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journal(variables.userId, variables.tradeId, variables.calculationMethod)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.journals(variables.userId)
      })
      queryClient.invalidateQueries({
        queryKey: ['journals']
      })

      // Invalidate trades queries (commission value changed)
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['allTrades'] })
      queryClient.invalidateQueries({ queryKey: ['trade', variables.userId, variables.tradeId] })

      // Invalidate stats queries (backend recalculates)
      queryClient.invalidateQueries({ queryKey: ['stats'] })

      toast.success('Commission override saved successfully')
    },
    onError: (error: any) => {
      console.error('Failed to save commission override:', error)
      toast.error(error.message || 'Failed to save commission override')
    }
  })
}